import express, { response } from "express";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import prisma from "../utils/prisma.js";
import tokenDecodificar from "../utils/tokenDecodificar.js";
const router = express.Router();

router.post("/", async (req, res) => {
  let compraTemporaria = null;

  try {
    const { valorCompra, compras } = req.body.dadosProdutos;

    const body = JSON.parse(req.body.dados.body);

    const token = await tokenDecodificar.decodedToken(
      req.headers.authorization
    );
    const usuarioId = token.id;

    if (!usuarioId) {
      return res.status(400).json({ error: "ID do usuário é obrigatório" });
    }
    const items = [];
    // 🔥 PRIMEIRO: Criar compra temporária
    compraTemporaria = await prisma.compra.create({
      data: {
        usuarioId: usuarioId,
        parcelas: parseInt(body.installments) || 1,
        status: "processando", // status temporário
        itens: {
          create: compras.map((item) => {
            items.push({
              id: item.produto.id,
              category_id: item.produto.categoriaId,
              description: item.produto.descricao,
              quantity: item.quantidadeComprado,
              title: item.produto.tituloProduto,
              unit_price: parseFloat(
                item.produto.precoCentavos.toString().replace(",", ".")
              ),
            });
            const precoUnitarioCentavos = Math.round(
              parseFloat(
                item.produto.precoCentavos.toString().replace(",", ".")
              )
            );
            return {
              produtoId: item.produto.id,
              nomeProduto: item.produto.tituloProduto,
              descricao: item.produto.descricao,
              imagem: item.produto.imagem,
              precoUnitario: precoUnitarioCentavos,
              quantidade: item.quantidadeComprado,
              subtotal: precoUnitarioCentavos * item.quantidadeComprado,
            };
          }),
        },
      },
    });

    const externalReference = compraTemporaria.id.toString();

    // 🔥 Processar no Mercado Pago
    const client = new MercadoPagoConfig({
      accessToken: process.env.PAYMENT_TOKEN_ACESS_PRODUCT,
    });

    const payment = new Payment(client);
    const uniqueKey = `payment_${usuarioId}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 8)}`;
    console.log(items);
    const paymentBody = {
      transaction_amount: parseFloat(body.transaction_amount),
      token: body.token,
      description: body.description,
      installments: parseInt(body.installments) || 1,
      payment_method_id: body.payment_method_id,
      issuer_id: body.issuer_id,
      payer: {
        email: body.payer.email,
        identification: {
          type: body.payer.identification.type,
          number: body.payer.identification.number,
        },
      },
      notification_url: `${process.env.URL_BACKEND}/pagamento/payment-webhook-mp`,
      external_reference: externalReference,
      statement_descriptor: "Maia Store",
    };

    let result;
    try {
      result = await payment.create({
        body: paymentBody,
        requestOptions: { idempotencyKey: uniqueKey },
      });
    } catch (mpError) {
      console.log(mpError);
      // Se der erro no MP, deletar a compra temporária
      await prisma.$transaction([
        prisma.compraItem.deleteMany({
          where: { compraId: compraTemporaria.id },
        }),
        prisma.compra.delete({
          where: { id: compraTemporaria.id },
        }),
      ]);

      throw mpError;
    }

    console.log("MP Payment ID:", result.id);
    console.log("MP Status:", result.status);

    // 🔥 CORREÇÃO: Usar findFirst em vez de findUnique
    const compraExistente = await prisma.compra.findFirst({
      where: {
        mpIdCompra: result.id.toString(),
      },
    });

    if (compraExistente) {
      // Se já existe, deletar a temporária e retornar a existente
      await prisma.compra.delete({
        where: { id: compraTemporaria.id },
      });

      return res.status(200).json({
        message: "Pagamento já foi processado anteriormente",
        compraExistente: compraExistente,
        resultado: result,
      });
    }

    // 🔥 Se o pagamento foi rejeitado, tratar adequadamente
    if (result.status === "rejected") {
      const compraAtualizada = await prisma.compra.update({
        where: { id: compraTemporaria.id },
        data: {
          status: "rejeitado",
          dataCriado: new Date(result.date_created),
          mpIdCompra: result.id.toString(),
          valorCentavos: Math.round(
            result.transaction_details.total_paid_amount * 100
          ),
          metodoPagamento: result.payment_method.type,
        },
      });

      return res.status(400).json({
        error: "Pagamento rejeitado pelo Mercado Pago",
        compraBanco: compraAtualizada,
        resultado: result,
      });
    }

    // 🔥 Se foi aprovado, atualizar estoque e compra
    const compraAtualizada = await prisma.$transaction(async (tx) => {
      // Atualizar estoque apenas se o pagamento foi aprovado
      if (result.status === "approved") {
        for (const item of compras) {
          await tx.produto.update({
            where: { id: item.produto.id },
            data: {
              QtdEstoque: { decrement: item.quantidadeComprado },
            },
          });
        }
      }

      // Atualizar compra com dados do MP
      return await tx.compra.update({
        where: { id: compraTemporaria.id },
        data: {
          status: result.status === "approved" ? "aprovado" : "pendente",
          dataCriado: new Date(result.date_created),
          mpIdCompra: result.id.toString(),
          valorCentavos: Math.round(
            result.transaction_details.total_paid_amount * 100
          ),
          metodoPagamento: result.payment_method.type,
        },
        include: {
          itens: true,
          usuario: {
            select: { id: true, nome: true, email: true },
          },
        },
      });
    });

    const responseData = {
      message:
        result.status === "approved"
          ? "Sucesso, compra realizada e salva!"
          : "Pagamento pendente de aprovação",
      resultado: result,
      compraBanco: compraAtualizada,
    };

    res.status(201).json(responseData);
  } catch (error) {
    console.log("Erro ao processar pagamento:", error);

    // Limpar compra temporária em caso de erro
    if (compraTemporaria) {
      try {
        await prisma.compra.delete({
          where: { id: compraTemporaria.id },
        });
      } catch (deleteError) {
        console.log("Erro ao limpar compra temporária:", deleteError);
      }
    }

    // Tratamento específico para P2002
    if (error.code === "P2002") {
      return res.status(400).json({
        error: "Erro de duplicação no banco de dados",
        details: "Tente novamente em alguns instantes",
      });
    }

    res.status(error.status || 500).json({
      error: "Erro ao processar pagamento",
      details: error.message,
    });
  }
});

// //endPoind para webHook

router.post("/payment-webhook-mp", async (req, res) => {
  console.log("Webhook recebido");

  try {
    if (!req.body.data || !req.body.data.id) {
      return res.status(400).json({ error: "Dados inválidos" });
    }

    const paymentId = req.body.data.id;
    console.log(`Processando webhook para pagamento: ${paymentId}`);

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYMENT_TOKEN_ACESS_PRODUCT}`,
        },
      }
    );

    if (!mpResponse.ok) {
      throw new Error(`Erro ao buscar pagamento: ${mpResponse.status}`);
    }

    const pagamento = await mpResponse.json();

    const mpId = pagamento.id.toString();

    const compraAtualizada = await prisma.compra.update({
      where: { mpIdCompra: mpId }, // Agora funciona com @unique
      data: { status: pagamento.status },
    });

    console.log("Status atualizado:", compraAtualizada.status);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Erro no webhook:", error);

    if (error.code === "P2025") {
      console.log("Compra não encontrada para o ID:", req.body.data.id);
      return res.status(404).json({ error: "Compra não encontrada" });
    }

    res.status(500).json({ error: "Erro interno" });
  }
});
export default router;
