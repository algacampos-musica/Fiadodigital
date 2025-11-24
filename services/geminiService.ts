import { GoogleGenAI } from "@google/genai";
import { Debtor, Transaction, TransactionType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

export const generateReminderMessage = async (
  debtor: Debtor,
  totalDebt: number,
  tone: 'polite' | 'firm' | 'funny'
): Promise<string> => {
  try {
    const prompt = `
      Você é um assistente financeiro de uma mercearia/loja local.
      Gere uma mensagem curta para WhatsApp cobrando o cliente.
      
      Cliente: ${debtor.name}
      Valor devido: R$ ${totalDebt.toFixed(2)}
      Tom: ${tone} (polite = educado/amigável, firm = sério/profissional, funny = engraçado/descontraído)
      
      A mensagem deve ser direta, conter o valor e sugerir que ele passe na loja para acertar.
      Não use placeholders, gere o texto final.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "Não foi possível gerar a mensagem.";
  } catch (error) {
    console.error("Erro ao gerar mensagem:", error);
    return "Erro ao conectar com a IA para gerar mensagem.";
  }
};

export const analyzeFinancialStatus = async (
  debtor: Debtor,
  transactions: Transaction[]
): Promise<string> => {
  try {
    const debtHistory = transactions
      .filter(t => t.type === TransactionType.DEBT)
      .slice(-5)
      .map(t => `Data: ${new Date(t.date).toLocaleDateString()}, Valor: R$${t.totalAmount}`)
      .join('\n');
      
    const paymentHistory = transactions
      .filter(t => t.type === TransactionType.PAYMENT)
      .slice(-5)
      .map(t => `Data: ${new Date(t.date).toLocaleDateString()}, Valor: R$${t.totalAmount}`)
      .join('\n');

    const prompt = `
      Analise o perfil deste cliente da "Caderneta de Fiado".
      Cliente: ${debtor.name}
      
      Últimas compras (Dívidas):
      ${debtHistory || "Nenhuma compra recente"}
      
      Últimos pagamentos:
      ${paymentHistory || "Nenhum pagamento recente"}
      
      Forneça um resumo curto (máximo 3 linhas) sobre o comportamento de pagamento deste cliente e se devo continuar vendendo fiado para ele. Seja direto e um pouco informal.
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "Análise indisponível.";
  } catch (error) {
    console.error("Erro na análise:", error);
    return "Erro ao realizar análise de IA.";
  }
};