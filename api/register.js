export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });

  const { nome, cpf, dataNascimento, sexo, telefone, email } = req.body;
  if (!nome || !cpf || !dataNascimento || !sexo || !telefone) {
    return res.status(400).json({ erro: 'Campos obrigatorios: nome, cpf, dataNascimento, sexo, telefone' });
  }

  const API_KEY = process.env.PACTO_API_KEY;
  const EMPRESA_ID = process.env.PACTO_EMPRESA_ID || '1';
  const BASE = 'https://apigw.pactosolucoes.com.br';

  try {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const telLimpo = telefone.replace(/\D/g, '');

    const params = new URLSearchParams({
      nome: nome.toUpperCase(),
      cpf: cpfLimpo,
      dataNascimento: dataNascimento,
      sexo: sexo,
      telCelular: telLimpo,
      empresa: EMPRESA_ID
    });
    params.append('email', email || '');

    const url = `${BASE}/cliente/cadastrarCliente?${params.toString()}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + API_KEY, 'empresaId': EMPRESA_ID }
    });

    let data;
    const text = await resp.text();
    try { data = JSON.parse(text); } catch (e) {
      if (resp.ok) data = { resultado: text };
      else return res.status(500).json({ erro: 'Erro API: ' + text.substring(0, 200) });
    }

    if (data.erro) return res.status(500).json({ erro: data.erro });

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao cadastrar: ' + err.message });
  }
}
