import express from "express";
import prisma from "../utils/prisma.js";
import upload from "../src/config/upload.js";
import cloudinary from "../src/config/cloudinary.js";
import fs from "fs";

const app = express();
app.post("/", upload.single("imagem"), async (req, res) => {
  console.log("Arquivo recebido:", req.file); // Verifique se o arquivo chega
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Nenhum arquivo recebido",
        headers: req.headers, // Mostra os headers recebidos
        body: req.body,
      });
    }

    // 1. Upload para o Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "",
    });

    // 2. Salva no banco de dados
    const produto = await prisma.produto.create({
      data: {
        tituloProduto: req.body.tituloProduto,
        descricao: req.body.descricao,
        precoCentavos: parseInt(req.body.precoCentavos),
        QtdEstoque: parseInt(req.body.QtdEstoque),
        imagem: result.secure_url, // URL da imagem no Cloudinary
      },
    });

    // 3. Remove o arquivo temporário
    fs.unlinkSync(req.file.path);

    res.status(201).json(produto);
  } catch (error) {
    console.error("Erro no upload:", error);
    res.status(500).json({ error: "Erro ao processar a imagem." });
  }
});

app.put("/", upload.single("imagem"), async (req, res) => {
  console.log("req.body:", req.body);
  console.log("req.file:", req.file);

  const produto = {
    id: req.body.id,
    tituloProduto: req.body.tituloProduto,
    descricao: req.body.descricao,
    precoCentavos: parseInt(req.body.precoCentavos),
    QtdEstoque: parseInt(req.body.QtdEstoque),
  };

  if (!produto.id) {
    return res.status(400).json({ message: "ID do produto é obrigatório" });
  }

  try {
    // 1. Buscar produto atual
    const produtoAtual = await prisma.produto.findUnique({
      where: { id: produto.id },
      select: { imagem: true },
    });

    if (!produtoAtual) {
      return res.status(404).json({ message: "Produto não encontrado" });
    }

    let novaImagemUrl = produtoAtual.imagem; // por padrão mantém a antiga

    // 2. Se veio uma nova imagem, faz upload
    if (req.file) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: "",
        });

        novaImagemUrl = uploadResult.secure_url;

        // 3. Se tinha imagem antiga, deletar no Cloudinary
        if (
          produtoAtual.imagem &&
          produtoAtual.imagem.includes("cloudinary.com")
        ) {
          const urlParts = produtoAtual.imagem.split("/");
          const publicIdWithExtension = urlParts[urlParts.length - 1];
          const publicId = publicIdWithExtension.split(".")[0];

          await cloudinary.uploader.destroy(publicId);
          console.log(`Imagem antiga deletada: ${publicId}`);
        }

        // ✅ Apagar arquivo temporário do servidor
        fs.unlinkSync(req.file.path);
      } catch (uploadError) {
        console.error("Erro no upload:", uploadError);
        return res
          .status(500)
          .json({ message: "Erro ao fazer upload da imagem" });
      }
    }

    // 4. Atualizar produto no banco
    const produtoAtualizado = await prisma.produto.update({
      where: { id: produto.id },
      data: {
        tituloProduto: produto.tituloProduto,
        descricao: produto.descricao,
        precoCentavos: produto.precoCentavos,
        QtdEstoque: produto.QtdEstoque,
        imagem: novaImagemUrl,
      },
    });

    res.status(200).json({
      message: "Produto atualizado com sucesso!",
      produto: produtoAtualizado,
    });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ message: "Erro no servidor, tente novamente!" });
  }
});

// Configuração (se ainda não fez)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NOME,
  api_key: process.env.CLOUDINARY_CHAVE_API,
  api_secret: process.env.CLOUDINARY_SECRET_CHAVE,
});

app.delete("/", async (req, res) => {
  console.log("Requisição recebida:", req.body);

  try {
    const { array } = req.body;

    // Validações
    if (!array || !Array.isArray(array) || array.length === 0) {
      return res.status(400).json({
        message: "Campo 'array' é obrigatório e deve ser um array não vazio",
      });
    }

    console.log(`Tentando remover ${array.length} produtos:`, array);

    // Busca os produtos antes de deletar
    const produtos = await prisma.produto.findMany({
      where: { id: { in: array } },
      select: { id: true, imagem: true, tituloProduto: true },
    });

    console.log(`Encontrados ${produtos.length} produtos no banco`);

    if (produtos.length === 0) {
      return res.status(404).json({
        message: "Nenhum produto encontrado com os IDs fornecidos",
      });
    }

    // Verificar configuração do Cloudinary antes de tentar remover imagens
    const cloudinaryConfigured =
      process.env.CLOUDINARY_NOME &&
      process.env.CLOUDINARY_CHAVE_API &&
      process.env.CLOUDINARY_SECRET_CHAVE;

    console.log("Cloudinary configurado:", cloudinaryConfigured);

    // Deletar imagens do Cloudinary (apenas se configurado)
    const imagensRemovidasComSucesso = [];
    const errosImagens = [];

    if (cloudinaryConfigured) {
      for (const produto of produtos) {
        if (produto.imagem) {
          try {
            // Extrair public_id da URL do Cloudinary
            let publicId;

            if (produto.imagem.includes("cloudinary.com")) {
              // URL completa do Cloudinary
              const urlParts = produto.imagem.split("/");
              const uploadIndex = urlParts.findIndex(
                (part) => part === "upload"
              );

              if (uploadIndex !== -1 && urlParts[uploadIndex + 2]) {
                // Pega tudo após /upload/v123456/
                const pathAfterVersion = urlParts
                  .slice(uploadIndex + 2)
                  .join("/");
                publicId = pathAfterVersion.split(".")[0]; // Remove extensão
              }
            } else {
              // Se não for URL completa, assume que já é o public_id
              publicId = produto.imagem.split(".")[0];
            }

            if (publicId) {
              console.log(`Removendo imagem com public_id: ${publicId}`);

              const cloudinaryResult = await cloudinary.uploader.destroy(
                publicId
              );
              console.log(
                `Resultado Cloudinary para ${publicId}:`,
                cloudinaryResult
              );

              if (
                cloudinaryResult.result === "ok" ||
                cloudinaryResult.result === "not found"
              ) {
                imagensRemovidasComSucesso.push(publicId);
              } else {
                console.warn(
                  `Falha ao remover imagem ${publicId}:`,
                  cloudinaryResult
                );
                errosImagens.push({
                  produtoId: produto.id,
                  publicId: publicId,
                  resultado: cloudinaryResult,
                });
              }
            } else {
              console.warn(
                `Não foi possível extrair public_id da URL: ${produto.imagem}`
              );
              errosImagens.push({
                produtoId: produto.id,
                erro: "Não foi possível extrair public_id da URL",
              });
            }
          } catch (imageError) {
            console.error(
              `Erro ao remover imagem do produto ${produto.id}:`,
              imageError
            );
            errosImagens.push({
              produtoId: produto.id,
              erro: imageError.message,
            });
          }
        }
      }
    } else {
      console.warn("Cloudinary não configurado - pulando remoção de imagens");
    }

    // Agora deleta os produtos do banco
    const resultado = await prisma.produto.deleteMany({
      where: { id: { in: array } },
    });

    console.log(`${resultado.count} produtos removidos do banco`);

    // Resposta com informações detalhadas
    const response = {
      message: `${resultado.count} produtos removidos com sucesso!`,
      detalhes: {
        produtosRemovidosDoBanco: resultado.count,
        imagensRemovidasDoCloudinary: imagensRemovidasComSucesso.length,
        produtosEncontrados: produtos.length,
        cloudinaryConfigurado: cloudinaryConfigured,
      },
    };

    // Adiciona avisos se houver problemas
    if (errosImagens.length > 0) {
      response.avisos = {
        imagensComErro: errosImagens,
        mensagem:
          "Alguns produtos foram removidos mas suas imagens podem ainda estar no Cloudinary",
      };
    }

    if (!cloudinaryConfigured) {
      response.avisos = {
        ...response.avisos,
        cloudinary:
          "Cloudinary não configurado - imagens não foram removidas do storage",
      };
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Erro completo:", error);
    return res.status(500).json({
      message: "Erro no servidor, tente novamente!",
      erro: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default app;
