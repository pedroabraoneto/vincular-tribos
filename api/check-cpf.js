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
  const headers = { 'Authorization': 'Bearer ' + API_KEY, 'empresaId': EMPRESA_ID };

  try {
    // Step 1: Buscar via /clientes/simplificado (retorna matricula e nome)
    const respSimp = await fetch(`${BASE}/clientes/simplificado?cpf=${cpfLimpo}`, { headers });
    const dataSimp = await respSimp.json();
    const simpContent = dataSimp.content || [];

    if (simpContent.length === 0) {
      return res.status(200).json({ existe: false });
    }

    const matricula = String(simpContent[0].codigoMatricula).padStart(6, '0');

    // Step 2: Buscar dados completos via /cadastro-cliente/consultar
    const filters = encodeURIComponent(JSON.stringify({ documento: cpfLimpo, empresa: parseInt(EMPRESA_ID) }));
    const respFull = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filters}&page=0&size=1`, { headers });
    const dataFull = await respFull.json();

    if (dataFull.content && dataFull.content.length > 0) {
      const c = dataFull.content[0];
      return res.status(200).json({
        existe: true,
        pessoa: c.pessoa,
        cliente: c.cliente,
        nome: c.nome,
        matricula: c.matricula || matricula,
        situacao: c.situacao,
        urlFoto: c.urlFoto || null,
        telefone: c.telefone || '',
        email: c.email || '',
        cpf: c.cpf || ''
      });
    }

    // Fallback: retornar dados do simplificado
    return res.status(200).json({
      existe: true,
      matricula: matricula,
      nome: simpContent[0].nome,
      situacao: simpContent[0].situacaoDescricao === 'Ativo' ? 'AT' : 'VI'
    });
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao consultar: ' + err.message });
  }
}
