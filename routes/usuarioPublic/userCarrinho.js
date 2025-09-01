import express from "express";
import tokenDecodificar from "../../utils/tokenDecodificar.js";
import prisma from "../../utils/prisma.js";

const router = express.Router();
router.post("/", async (req, res) => {
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
router.get("/", async (req, res) => {
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
    console.log(error);
    res
      .status(500)
      .json({ message: "Erro no servidor, tente novamente!", erro: { error } });
  }
});
router.put("/", async (req, res) => {
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

export default router;
