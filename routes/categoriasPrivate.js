import express from "express";
import prisma from "../utils/prisma.js";
const app = express();
app.post("/", async (req, res) => {
  if (req.body.categoria == null || req.body.categoria == undefined) {
    res
      .status(400)
      .json({ message: "Categoria está vazia, preencha os dados!" });
  }
  const categoria = req.body.categoria;
  try {
    const response = await prisma.categoria.create({
      data: {
        nome: categoria,
      },
    });
    res.status(201).json({
      message: "Categoria criada com sucesso!",
      categoria: response.nome,
    });
  } catch (error) {
    res.status(500).json({
      message: "Ocorreu um erro no servidor, tente novamente!",
      erro: error,
    });
  }
});
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
app.put("/", async (req, res) => {
  console.log(req.body.categoria.nome);
  if (req.body.categoria.nome == undefined || req.body.categoria.nome == "") {
    res.status(401).json({ message: "Categoria vazia, digite alguma!" });
  }
  const { nome, id } = req.body.categoria;
  const response = await prisma.categoria.update({
    where: { id: id },
    data: {
      nome: nome,
    },
  });
  res.status(200).json({
    message: "Categoria editada com sucesso!",
    categoria: response.nome,
  });
});
export default app;
