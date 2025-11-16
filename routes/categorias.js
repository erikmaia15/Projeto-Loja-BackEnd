import express from "express";
import prisma from "../utils/prisma.js";
const app = express();

app.get("/", async (req, res) => {
  try {
    const response = await prisma.categoria.findMany({
      select: {
        nome: true,
        id: true,
      },
    });
    console.log(response);
    res.status(200).json({
      message: "Categorias listadas com sucesso!",
      categorias: response,
    });
  } catch (error) {
    res.status(500).json({
      message: "Ocorreu algum erro no servidor, tente novamente!",
      erro: error,
    });
  }
});

app.get("/categoriaById/:id", async (req, res) => {
  const categoriaId = req.params.id;
  console.log(categoriaId);
  if (!categoriaId || categoriaId.trim() === "") {
    return res
      .status(400)
      .json({ message: "O id da categoria não foi enviado!" });
  }

  try {
    const response = await prisma.categoria.findUnique({
      where: { id: categoriaId },
      select: {
        nome: true,
      },
    });

    // Verifica se a categoria foi encontrada
    if (!response) {
      return res.status(404).json({ message: "Categoria não encontrada!" });
    }

    res.status(200).json({
      message: "Categoria listada com sucesso!",
      data: response,
    });
  } catch (error) {
    console.error("Erro no servidor:", error);
    res.status(500).json({
      message: "Ocorreu um erro no servidor, tente novamente!",
    });
  }
});

app.get("/produtos-categorias/:id", async (req, res) => {
  const categoriaId = req.params.id;

  // Validação mais robusta
  if (!categoriaId || categoriaId.trim() === "") {
    return res
      .status(400)
      .json({ message: "O id da categoria não foi enviado!" });
  }

  try {
    const response = await prisma.categoria.findUnique({
      where: { id: categoriaId },
      select: {
        nome: true,
        produtos: true,
      },
    });

    // Verifica se a categoria foi encontrada
    if (!response) {
      return res.status(404).json({ message: "Categoria não encontrada!" });
    }

    res.status(200).json({
      message: "Produtos da categoria listados com sucesso!",
      data: response,
    });
  } catch (error) {
    console.error("Erro no servidor:", error);
    res.status(500).json({
      message: "Ocorreu um erro no servidor, tente novamente!",
    });
  }
});
export default app;
