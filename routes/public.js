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
      { expiresIn: "1m" }
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
    res.status(404).json({ message: "usuário não encontrado " });
  }
});

export default router;
