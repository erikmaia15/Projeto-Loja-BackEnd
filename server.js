import express from "express";
import cors from "cors";

const app = express();

// ✅ DEBUG: Monitora TODOS os imports
const originalConsoleLog = console.log;
console.log = function (...args) {
  // Silencia undefined completamente temporariamente
  if (args.length === 1 && args[0] === undefined) {
    const stack = new Error().stack;
    console.error("🚨 UNDEFINED SILENCIADO - Stack:", stack);
    return;
  }
  originalConsoleLog.apply(console, args);
};

app.use(express.json());
app.use(cors());

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Server running",
    timestamp: new Date().toISOString(),
  });
});

// ✅ DEBUG: Importação monitorada de CADA arquivo
console.log("=== INICIANDO IMPORTS MONITORADOS ===");

try {
  console.log("1. Importando prisma...");
  const prismaModule = await import("./utils/prisma.js");
  console.log("✅ prisma importado");

  console.log("2. Importando tokenDecodificar...");
  const tokenDecodificar = await import("./utils/tokenDecodificar.js");
  console.log("✅ tokenDecodificar importado");

  console.log("3. Importando conversaoMoedas...");
  const conversaoMoedas = await import("./utils/conversaoMoedas.js");
  console.log("✅ conversaoMoedas importado");

  console.log("4. Importando rotas públicas...");
  const PublicRoutes = await import("./routes/public.js");
  console.log("✅ PublicRoutes importado");

  console.log("5. Importando adminAuth...");
  const adminAuth = await import("./middlewares/adminAuth.js");
  console.log("✅ adminAuth importado");

  console.log("6. Importando rotas privadas...");
  const PrivateRoutes = await import("./routes/private.js");
  console.log("✅ PrivateRoutes importado");

  // Configurar rotas
  app.use("/", PublicRoutes.default);
  app.use("/", adminAuth.default, PrivateRoutes.default);

  console.log("✅ Todas as rotas configuradas com sucesso!");
} catch (error) {
  console.error("❌ Erro durante importação:", error.message);
  console.error("Stack:", error.stack);
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
