import express from "express";
import tokenDecodificar from "../../utils/tokenDecodificar.js";
import prisma from "../../utils/prisma.js";
const router = express.Router();

router.get("/", async (req, res) => {
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

export default router;
