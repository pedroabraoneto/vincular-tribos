export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { cpf } = req.query;
  if (!cpf) return res.status(400).json({ erro: 'CPF obrigatorio' });

  const cpfLimpo = cpf.replace(/\D/g, '');
  if (cpfLimpo.length !== 11) return res.status(400).json({ erro: 'CPF invalido' });

  const API_KEY = process.env.PACTO_API_KEY;
  const EMPRESA_ID = process.env.PACTO_EMPRESA_ID || '1';
  const BASE = 'https://apigw.pactosolucoes.com.br';

  try {
    const filters = encodeURIComponent(JSON.stringify({ documento: cpfLimpo, empresa: parseInt(EMPRESA_ID) }));
    const url = `${BASE}/cadastro-cliente/consultar?filters=${filters}&page=0&size=1`;

    const resp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + API_KEY, 'empresaId': EMPRESA_ID }
    });

    const data = await resp.json();

    if (!data.content || data.content.length === 0) {
      return res.status(200).json({ existe: false });
    }

    const c = data.content[0];
    return res.status(200).json({
      existe: true,
      pessoa: c.pessoa,
      cliente: c.cliente,
      nome: c.nome,
      matricula: c.matricula,
      situacao: c.situacao,
      urlFoto: c.urlFoto || null
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao consultar: ' + err.message });
  }
}
