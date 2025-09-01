import prisma from "../../utils/prisma.js";
import bcrypt from "bcrypt";
import express from "express";
const router = express.Router();
router.post("/", async (req, res) => {
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

export default router;
