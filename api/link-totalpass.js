export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });

  const { matricula, codigo, pessoa } = req.body;
  if (!codigo) {
    return res.status(400).json({ erro: 'codigo TotalPass obrigatorio' });
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
    const resp = await fetch(`${BASE}/clientes/autoriza-acesso-totalpass`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        codigoAutorizacao: codigo,
        token: codigo,
        matricula: matricula,
        codigoPessoa: pessoa
      })
    });

    let data;
    const text = await resp.text();
    try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }

    if (!resp.ok) {
      return res.status(500).json({ erro: 'Erro ao autorizar TotalPass', detalhes: data });
    }

    return res.status(200).json({ sucesso: true, autorizacao: data });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao vincular TotalPass: ' + err.message });
  }
}
