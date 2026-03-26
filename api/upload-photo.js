export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ erro: 'Use POST' });

  const { pessoa, foto } = req.body;
  if (!pessoa || !foto) return res.status(400).json({ erro: 'pessoa e foto sao obrigatorios' });

  const API_KEY = process.env.PACTO_API_KEY;
  const EMPRESA_ID = process.env.PACTO_EMPRESA_ID || '1';
  const BASE = 'https://apigw.pactosolucoes.com.br';

  try {
    // 1. Atualizar foto
    const fotoBase64 = foto.replace(/^data:image\/\w+;base64,/, '');
    const urlFoto = `${BASE}/cliente/atualizarFotoCliente?codigopessoa=${pessoa}`;

    const respFoto = await fetch(urlFoto, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'empresaId': EMPRESA_ID,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'foto=' + encodeURIComponent(fotoBase64)
    });

    let dataFoto;
    const textFoto = await respFoto.text();
    try { dataFoto = JSON.parse(textFoto); } catch (e) {
      dataFoto = respFoto.ok ? { return: textFoto || 'ok' } : { erro: textFoto.substring(0, 200) };
    }

    if (dataFoto.erro || (dataFoto.return && dataFoto.return.startsWith('ERRO'))) {
      return res.status(500).json({ erro: 'Erro ao salvar foto: ' + (dataFoto.erro || dataFoto.return) });
    }

    // 2. Atualizar template facial
    const respTemplate = await fetch(`${BASE}/cliente/atualizaTemplateFacial`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'empresaId': EMPRESA_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ codigoPessoa: pessoa })
    });

    let dataTemplate = {};
    try { dataTemplate = await respTemplate.json(); } catch (e) {}

    return res.status(200).json({ sucesso: true, urlFoto: dataFoto.return || null, templateFacial: dataTemplate });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao enviar foto: ' + err.message });
  }
}
