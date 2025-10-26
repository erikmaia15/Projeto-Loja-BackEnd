import express, { response } from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import prisma from "../utils/prisma.js";
import tokenDecodificar from "../utils/tokenDecodificar.js";
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { valorCompra, compras } = req.body.dadosProdutos;
    console.log("compras:", compras);

    const valorCompraBaseFormatado = parseInt(valorCompra.replace(",", ""));
    const client = new MercadoPagoConfig({
      accessToken: process.env.PAYMENT_TOKEN_ACESS_PRODUCT,
    });

    const payment = new Payment(client);
    const body = JSON.parse(req.body.dados.body);

    // Gerar chave única
    const reverseTimestamp = Date.now().toString().split("").reverse().join("");
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const uniqueKey = `payment_${reverseTimestamp}_${randomSuffix}`;

    const paymentBody = {
      transaction_amount: body.transaction_amount,
      token: body.token,
      description: body.description,
      installments: body.installments,
      payment_method_id: body.payment_method_id,
      issuer_id: body.issuer_id,
      payer: {
        email: body.payer.email,
        identification: {
          type: body.payer.identification.type,
          number: body.payer.identification.number,
        },
      },
      notification_url: "https://projeto-loja-maiastore-backend.onrender.com/",
    };

    // Processar pagamento no Mercado Pago
    const result = await payment.create({
      body: paymentBody,
      requestOptions: { idempotencyKey: uniqueKey },
    });

    console.log("Resultado MP:", result.status);

    // CORREÇÃO: Usar BigInt para o ID grande
    const idCompra = result.id.toString();
    const metodoPagamento = result.payment_method.type;
    const status = result.status;
    const Qtdparcelas = result.installments;
    const valorParcelaCentavos = Math.round(
      result.transaction_details.installment_amount * 100
    );
    const totalAPagarCentavos = Math.round(
      result.transaction_details.total_paid_amount * 100
    );
    const dataCriado = new Date(result.date_created);

    // Obter usuário
    const token = await tokenDecodificar.decodedToken(
      req.headers.authorization
    );
    const usuarioId = token.id;

    if (!usuarioId) {
      return res.status(400).json({ error: "ID do usuário é obrigatório" });
    }

    // Preparar itens da compra
    const itensCompra = compras.map((item) => {
      const precoUnitarioCentavos = Math.round(
        parseFloat(item.produto.precoCentavos.replace(",", ".")) * 100
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
    });

    // Salvar no banco com transação
    const compraSalva = await prisma.$transaction(async (tx) => {
      // Criar compra principal
      const novaCompra = await tx.compra.create({
        data: {
          usuarioId: usuarioId,
          mpIdCompra: idCompra, // Agora é BigInt
          valorCentavos: totalAPagarCentavos,
          parcelas: Qtdparcelas,
          status: status,
          metodoPagamento: metodoPagamento,
          dataCriado: dataCriado,
          itens: {
            create: itensCompra,
          },
        },
        include: {
          itens: true,
          usuario: {
            select: { id: true, nome: true, email: true },
          },
        },
      });

      // Atualizar estoque
      for (const item of compras) {
        await tx.produto.update({
          where: { id: item.produto.id },
          data: {
            QtdEstoque: { decrement: item.quantidadeComprado },
          },
        });
      }

      return novaCompra;
    });

    // CORREÇÃO: Converter BigInt para string na resposta JSON
    const compraObj = {
      idCompra: idCompra.toString(), // Converter para string
      metodoPagamento: metodoPagamento,
      status: status,
      Qtdparcelas: Qtdparcelas,
      valorBaseCompra: valorCompraBaseFormatado,
      totalAPagarCentavos: totalAPagarCentavos,
      valorParcelaCentavos: valorParcelaCentavos,
      dataCriado: dataCriado,
    };

    console.log(compraObj);

    // CORREÇÃO: Serializar manualmente para evitar erro BigInt
    const responseData = {
      message: "Sucesso, compra realizada e salva!",
      resultado: result,
      compraBanco: {
        ...compraSalva,
        mpIdCompra: compraSalva.mpIdCompra.toString(), // Converter para string
      },
    };

    res.status(201).json(responseData);
  } catch (error) {
    console.log("Erro ao processar pagamento:", error);

    // Tratamento específico para erro de serialização BigInt
    if (error.message.includes("serialize a BigInt")) {
      return res.status(500).json({
        error: "Erro interno de serialização",
        details: "Problema com formato de dados numéricos",
      });
    }

    if (error.code === "P2002") {
      return res.status(400).json({ error: "Erro de duplicação no banco" });
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
          Authorization: `Bearer ${process.env.PAYMENT_TOKEN_ACESS_TEST}`,
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
