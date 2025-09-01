import express from "express";
import prisma from "../utils/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import tokenDecodificar from "../utils/tokenDecodificar.js";
import conversaoMoedas from "../utils/conversaoMoedas.js";
import { MercadoPagoConfig, Payment } from "mercadopago";
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

router.post("/cadastro", async (req, res) => {
  const user = req.body;
  const salt = await bcrypt.genSalt(10);
  const hashSenha = await bcrypt.hash(user.senha, salt);
  try {
    const response = await prisma.user.create({
      data: {
        nome: user.nome,
        email: user.email,
        senha: hashSenha,
      },
    });
    res.status(201).json(response);
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: "Já existe um usuário com esse email!" });
  }
});
router.post("/login", async (req, res) => {
  const userinfo = req.body;
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: userinfo.email,
      },
    });
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    const isMatch = await bcrypt.compare(userinfo.senha, user.senha);
    if (!isMatch) {
      return res.status(400).json({ message: "Senha inválida" });
    }
    const token = jwt.sign(
      {
        id: user.id,
        isAdmin: user.isAdmin,
      },
      JWT_SECRET,
      { expiresIn: "3d" }
    );

    res.status(200).json(token);
  } catch (error) {
    res.status(500).json({ message: "Erro no servidor, tente novamente!" });
  }
});

router.get("/produtos", async (req, res) => {
  try {
    const response = await prisma.produto.findMany();
    if (response) {
      var produtos = conversaoMoedas.centavosParaReais(response);
    }
    return res
      .status(200)
      .json({ message: "Produtos listados com sucesso!", produtos: produtos });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Erro no servidor, tente novamente" });
  }
});

router.get("/usuarios", async (req, res) => {
  const tokenn = req.headers.authorization;
  const userInfosJwt = await tokenDecodificar.decodedToken(tokenn);
  try {
    const infosUser = await prisma.user.findUnique({
      where: { id: userInfosJwt.id },
    });
    res.status(200).json({
      message: "Usuário encontrado com sucesso!",
      usuario: infosUser,
    });
  } catch (error) {
    console.log(error);
    res.status(404).json({ message: "Usuário não encontrado, faça login " });
  }
});
router.post("/usuario-carrinho", async (req, res) => {
  const usuarioID = await tokenDecodificar.decodedToken(
    req.headers.authorization
  );
  const informacoes = req.body;
  const user = await prisma.user.findUnique({
    where: { id: usuarioID.id },
  });
  try {
    if (!user.carrinho.includes(informacoes.produtoId)) {
      // Só adiciona se não existir
      const response = await prisma.user.update({
        where: { id: usuarioID.id },
        data: {
          carrinho: {
            push: informacoes.produtoId,
          },
        },
      });
      res.status(201).json({
        message: "Produto adicionado com sucesso!",
        carrinhoIDs: response.carrinho,
      });
    } else {
      res.status(404).json({ message: "Produto já está no carrinho!" });
    }
  } catch (error) {
    res.status(500).json({ message: "Erro ao adicionar, tente novamente!" });
  }
});
router.get("/usuario-carrinho", async (req, res) => {
  const usuarioID = await tokenDecodificar.decodedToken(
    req.headers.authorization
  );
  try {
    const response = await prisma.user.findUnique({
      where: { id: usuarioID.id },
    });
    res.status(200).json({
      message: "Carrinho listado com sucesso!",
      carrinhoIds: response.carrinho,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Erro no servidor, tente novamente!", erro: { error } });
  }
});
router.put("/usuario-carrinho", async (req, res) => {
  try {
    const tokenUser = await tokenDecodificar.decodedToken(
      req.headers.authorization
    );
    const produtoId = req.body.produtoId;

    const user = await prisma.user.findUnique({
      where: { id: tokenUser.id },
    });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado!" });
    }
    const carrinhoAtualizado = user.carrinho.filter((id) => id !== produtoId);

    // Verifica se algum produto foi removido
    if (carrinhoAtualizado.length === user.carrinho.length) {
      return res.status(400).json({
        message: "Produto não encontrado no carrinho!",
      });
    }

    const response = await prisma.user.update({
      where: { id: user.id },
      data: {
        carrinho: carrinhoAtualizado,
      },
    });

    res.status(200).json({
      message: "Produto removido com sucesso!",
      carrinho: response.carrinho,
      produtoRemovido: produtoId,
    });
  } catch (error) {
    console.error("Erro ao remover produto:", error);
    res.status(500).json({
      message: "Erro no servidor, tenta novamente!",
      error: error.message,
    });
  }
});
router.put("/produtosRemovidosBanco", async (req, res) => {
  const produtos = req.body.produtos;
  console.log(produtos);
  if (produtos.length > 0) {
    const tokenUser = await tokenDecodificar.decodedToken(
      req.headers.authorization
    );
    if (tokenUser) {
      const user = await prisma.user.findUnique({
        where: {
          id: tokenUser.id,
        },
      });
      if (user) {
        const newProdutosUser = user.carrinho.filter(
          (produto) => !produtos.includes(produto)
        );
        if (newProdutosUser) {
          const response = await prisma.user.update({
            where: { id: user.id },
            data: {
              carrinho: newProdutosUser,
            },
          });
          console.log(response);
          return res
            .status(200)
            .json({ message: "carrinho atualizado!", user: response });
        }
      } else {
        return res.status(404).json({ message: "Usuário não encontrado!" });
      }
    } else {
      return res.status(404).json({ message: "Não está logado" });
    }
  } else {
    return res
      .status(404)
      .json({ message: "Nenhum produto foi removido do banco!" });
  }
});

router.post("/pagamento", async (req, res) => {
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
