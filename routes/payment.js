import express from "express";
import { MercadoPagoConfig, Payment } from "mercadopago";
const router = express.Router();

router.post("/", async (req, res) => {
  const { carrinho, valorCompra } = req.body.dadosProdutos;
  console.log(carrinho);
  console.log(valorCompra);
  const client = new MercadoPagoConfig({
    accessToken: process.env.PAYMENT_TOKEN_ACESS_TEST,
  });
  const body = JSON.parse(req.body.dados.body);
  const payment = new Payment(client);
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
  };
  payment
    .create({
      body: paymentBody,
      requestOptions: { idempotencyKey: uniqueKey },
    })
    .then((result) => {
      console.log(result);
      res.status(201).json({ message: "Sucesso, comprou!", resultado: result });
    })
    .catch((error) => {
      console.log(error);
      console.log("Erro completo:", JSON.stringify(error, null, 2));
      res.status(error.status || 500).json(error);
    });
});
export default router;
