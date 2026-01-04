import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
import prisma from "../utils/prisma.js";
import tokenDecodificar from "../utils/tokenDecodificar.js";

const router = express.Router();

/**
 * Converte "1,00" → 100
 */
function precoStringParaCentavos(valor) {
  return Math.round(
    Number(String(valor).replace(/\./g, "").replace(",", ".")) * 100
  );
}

router.post("/", async (req, res) => {
  try {
    if (!req.headers.authorization) {
      return res.status(401).json({ message: "Faça login para prosseguir!" });
    }

    const { compras, email } = req.body;

    if (!compras || compras.length === 0) {
      return res.status(400).json({ message: "Carrinho vazio" });
    }
    var user = await tokenDecodificar.decodedToken(req.headers.authorization);

    // 🔢 calcula total em centavos
    let totalCentavos = 0;

    const itensCompra = compras.map((item) => {
      const precoUnitario = precoStringParaCentavos(item.produto.precoCentavos);

      const quantidade = item.quantidadeComprado;

      const subtotal = precoUnitario * quantidade;
      totalCentavos += subtotal;

      return {
        produtoId: item.produto.id,
        nomeProduto: item.produto.tituloProduto,
        descricao: item.produto.descricao,
        imagem: item.produto.imagem,
        precoUnitario,
        quantidade,
        subtotal,
      };
    });

    // 1️⃣ cria compra no banco
    const compra = await prisma.compra.create({
      data: {
        usuarioId: user.id,
        status: "pending",
        metodoPagamento: "pix",
        valorCentavos: totalCentavos,
        parcelas: 1,
        dataCriado: new Date(),
        itens: {
          create: itensCompra,
        },
      },
    });
    if (compra) {
      await prisma.$transaction(async (tx) => {
        for (const item of compras) {
          const produto = await tx.produto.findUnique({
            where: { id: item.produto.id },
          });

          const estoqueDisponivel =
            produto.QtdEstoque - produto.QtdEstoqueReservado;

          if (estoqueDisponivel < item.quantidadeComprado) {
            res.status(400).json({
              message: "Estoque insuficiente para quantidade comprada!",
            });
            throw new Error(
              `Estoque insuficiente para ${produto.tituloProduto}`
            );
          }

          const produtoResult = await tx.produto.update({
            where: { id: item.produto.id },
            data: {
              QtdEstoqueReservado: {
                increment: item.quantidadeComprado,
              },
            },
          });
          console.log(produtoResult);
        }
      });
    }
    const client = new MercadoPagoConfig({
      accessToken: process.env.PAYMENT_TOKEN_ACESS_PRODUCT,
    });

    const payment = new Payment(client);
    let valorFinal = parseFloat(totalCentavos / 100);
    const descricao = compras[0].produto.descricao;
    const emailFinal =
      email && email.trim() !== ""
        ? email
        : user?.email && user.email.trim() !== ""
        ? user.email
        : "erik.maia15oliveira@gmail.com";
    const pagamento = await payment.create({
      body: {
        transaction_amount: valorFinal,
        description: descricao.toString(),
        payment_method_id: "pix",
        payer: {
          email: emailFinal,
        },
        external_reference: compra.id, // 🔥 ESSENCIAL
        notification_url: `${process.env.URL_BACKEND}/pagamento-pix/payment-webhook-mp`,
        // notification_url: `https://eb778bfe8289.ngrok-free.app/pagamento-pix/payment-webhook-mp`,
      },
      requestOptions: { idempotencyKey: compra.id },
    });

    // 3️⃣ salva ID do MP
    await prisma.compra.update({
      where: { id: compra.id },
      data: {
        mpIdCompra: pagamento.id.toString(),
      },
    });

    // 4️⃣ retorna QR Code
    return res.status(201).json({
      compraId: compra.id,
      status: pagamento.status,
      expiresAt: pagamento.date_of_expiration,
      qrCode: pagamento.point_of_interaction.transaction_data.qr_code,
      qrCodeBase64:
        pagamento.point_of_interaction.transaction_data.qr_code_base64,
      ticketUrl: pagamento.point_of_interaction.transaction_data.ticket_url,
    });
  } catch (error) {
    console.log(error);
    console.error("Erro PIX:", error);
    return res.status(500).json({
      message: "Erro ao gerar pagamento PIX",
    });
  }
});

/**
 * 🔔 WEBHOOK MERCADO PAGO
 */
router.post("/payment-webhook-mp", async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.sendStatus(200);

    const client = new MercadoPagoConfig({
      accessToken: process.env.PAYMENT_TOKEN_ACESS_PRODUCT,
    });

    const payment = new Payment(client);
    const mpPayment = await payment.get({ id: paymentId });

    const compraId = mpPayment.external_reference;
    if (!compraId) return res.sendStatus(200);

    // 🔒 Busca compra atual
    const compraAtual = await prisma.compra.findUnique({
      where: { id: compraId },
      include: { itens: true },
    });

    // 🛑 Idempotência
    if (!compraAtual || compraAtual.status !== "pending") {
      return res.sendStatus(200);
    }

    // 🔁 TRANSACTION
    await prisma.$transaction(async (tx) => {
      if (mpPayment.status === "approved") {
        await tx.compra.update({
          where: { id: compraId },
          data: { status: "paid" },
        });

        await Promise.all(
          compraAtual.itens.map((item) =>
            tx.produto.update({
              where: { id: item.produtoId },
              data: {
                QtdEstoque: {
                  decrement: item.quantidade,
                },
                QtdEstoqueReservado: {
                  decrement: item.quantidade,
                },
              },
            })
          )
        );
      }

      if (mpPayment.status === "expired") {
        await tx.compra.update({
          where: { id: compraId },
          data: { status: "EXPIRED" },
        });

        await Promise.all(
          compraAtual.itens.map((item) =>
            tx.produto.update({
              where: { id: item.produtoId },
              data: {
                QtdEstoqueReservado: {
                  decrement: item.quantidade,
                },
              },
            })
          )
        );
      }
    });

    return res.sendStatus(200);
  } catch (error) {
    console.error("❌ Erro webhook:", error);
    return res.sendStatus(500);
  }
});

router.get("/consultar-compra/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "Sem id da compra!" });
  }

  try {
    const compra = await prisma.compra.findUnique({
      where: { id },
    });

    if (!compra) {
      return res.status(404).json({ message: "Compra não encontrada" });
    }

    if (compra.status === "paid") {
      return res.status(200).json({ paid: true });
    }

    return res.status(200).json({ paid: false });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Erro de servidor" });
  }
});

export default router;
