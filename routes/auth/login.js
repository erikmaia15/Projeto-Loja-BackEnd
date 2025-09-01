import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import express from "express";
import prisma from "../../utils/prisma.js";
const JWT_SECRET = process.env.JWT_SECRET;
const router = express.Router();
router.post("/", async (req, res) => {
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
    console.log(error);
    res.status(500).json({ message: "Erro no servidor, tente novamente!" });
  }
});

export default router;
