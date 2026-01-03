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

    const user = await tokenDecodificar.decodedToken(req.headers.authorization);

    const { compras } = req.body;

    if (!compras || compras.length === 0) {
      return res.status(400).json({ message: "Carrinho vazio" });
    }

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
    console.log(compra);

    // 2️⃣ cria pagamento PIX
    const client = new MercadoPagoConfig({
      accessToken: process.env.PAYMENT_TOKEN_ACESS_PRODUCT,
    });

    const payment = new Payment(client);
    let valorFinal = parseFloat(totalCentavos / 100);
    console.log(valorFinal);
    console.log(compras[0].produto.descricao);
    console.log(user.email);
    const descricao = compras[0].produto.descricao;
    const pagamento = await payment.create({
      body: {
        transaction_amount: valorFinal,
        description: descricao.toString(),
        payment_method_id: "pix",
        payer: {
          email: "erik.maia15oliveira@gmail.com" || user.email,
        },
        notification_url: `${process.env.URL_BACKEND}/pagamento-pix/payment-webhook-mp`,
      },
      requestOptions: { idempotencyKey: compra.id },
    });
    // const pagamento = await payment.create({
    //   body: {
    //     transaction_amount: valorFinal, // PIX usa reais
    //     description: compras[0].produto.descricao,
    //     payment_method_id: "pix",
    //     payer: {
    //       email: user.email,
    //     },
    //     // notification_url: `${process.env.URL_BACKEND}/pagamento-pix/webhook`,
    //   },
    //   external_reference: compra.id, // 🔗 vínculo MP ↔ Compra
    // });

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

    if (mpPayment.status === "approved") {
      const resultado = await prisma.compra.update({
        where: { id: compraId },
        data: { status: "paid" },
      });
      console.log(resultado);
    }

    if (mpPayment.status === "expired") {
      const resultado = await prisma.compra.update({
        where: { id: compraId },
        data: { status: "expired" },
      });
      console.log(resultado);
    }
    return res.sendStatus(200);
  } catch (error) {
    console.error("Erro webhook:", error);
    return res.sendStatus(500);
  }
});

export default router;
