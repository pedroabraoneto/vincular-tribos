export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });

  const { matricula, codigo } = req.body;
  if (!matricula || !codigo) {
    return res.status(400).json({ erro: 'matricula e codigo sao obrigatorios' });
  }

  const API_KEY = process.env.PACTO_API_KEY;
  const EMPRESA_ID = process.env.PACTO_EMPRESA_ID || '1';
  const BASE = 'https://apigw.pactosolucoes.com.br';
  const headers = {
    'Authorization': 'Bearer ' + API_KEY,
    'empresaId': EMPRESA_ID,
    'Content-Type': 'application/json'
  };

  try {
    // Step 1: Cadastrar dados do GymPass
    const respDados = await fetch(`${BASE}/clientes/${matricula}/dados-gympass`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ gymPassUniqueToken: codigo, gymPassTypeNumber: codigo })
    });

    let dataDados;
    const textDados = await respDados.text();
    try { dataDados = JSON.parse(textDados); } catch (e) { dataDados = { raw: textDados }; }

    // Step 2: Autorizar acesso via GymPass
    const respAuth = await fetch(`${BASE}/clientes/${matricula}/autoriza-acesso-gympass`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ gymPassUniqueToken: codigo, gymPassTypeNumber: codigo })
    });

    let dataAuth;
    const textAuth = await respAuth.text();
    try { dataAuth = JSON.parse(textAuth); } catch (e) { dataAuth = { raw: textAuth }; }

    if (!respAuth.ok) {
      return res.status(500).json({
        erro: 'Erro ao autorizar Wellhub',
        detalhes: dataAuth,
        dadosGympass: dataDados
      });
    }

    return res.status(200).json({
      sucesso: true,
      dadosGympass: dataDados,
      autorizacao: dataAuth
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao vincular Wellhub: ' + err.message });
  }
}
