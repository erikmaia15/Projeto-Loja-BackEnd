import express from "express";
import prisma from "../utils/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import tokenDecodificar from "../utils/tokenDecodificar.js";

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
    res.status(404).json({ message: "Já existe usuário com esse email!" });
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
    const produtos = await prisma.produto.findMany();
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
  const tokenUser = await tokenDecodificar.decodedToken(
    req.headers.authorization
  );
  const produtoId = req.body.produtoId;
  const user = await prisma.user.findUnique({ where: { id: tokenUser.id } });
  user.carrinho.pop(produtoId);
  try {
    const response = await prisma.user.update({
      where: { id: user.id },
      data: {
        nome: user.nome,
        email: user.email,
        senha: user.senha,
        carrinho: user.carrinho,
      },
    });
    res.status(200).json({
      message: "Produto removido com sucesso!",
      produtoId: response.carrinho,
    });
  } catch (error) {
    res.status(500).json({ message: "Erro no servidor, tenta novamente!" });
    console.log(error);
  }
});

export default router;
