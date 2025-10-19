import prisma from "../utils/prisma.js";
import express from "express";
import tokenDecodificar from "../utils/tokenDecodificar.js";
const router = express.Router();
router.get("/", async (req, res) => {
  const token = await tokenDecodificar.decodedToken(req.headers.authorization);
  const compras = await prisma.compra.findMany({
    where: { usuarioId: token.id },
    include: {
      itens: true, // Isso já traz todos os itens de cada compra
      usuario: {
        select: {
          nome: true,
          email: true,
        },
      },
    },
    orderBy: {
      dataCriado: "desc", // Mais recentes primeiro
    },
  });

  console.log(compras);
  res.status(200).json({
    message: "Compras listadas com sucesso!",
    compras: compras,
  });
});
export default router;
