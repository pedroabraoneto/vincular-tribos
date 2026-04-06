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
  const headers = { 'Authorization': 'Bearer ' + API_KEY, 'empresaId': EMPRESA_ID };

  try {
    const cpfLimpo = cpf.replace(/\D/g, '');
    const telLimpo = telefone.replace(/\D/g, '');

    // STEP 1: Buscar se CPF ja existe no Pacto
    const filters = encodeURIComponent(JSON.stringify({ documento: cpfLimpo, empresa: parseInt(EMPRESA_ID) }));
    const checkResp = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filters}&page=0&size=1`, { headers });
    const checkData = await checkResp.json();

    if (checkData.content && checkData.content.length > 0) {
      // CPF JA EXISTE — retornar dados existentes (nao duplicar!)
      const c = checkData.content[0];
      return res.status(200).json({
        matricula: c.matricula,
        pessoa: c.pessoa,
        cliente: c.cliente,
        nome: c.nome,
        situacao: c.situacao,
        jaExistia: true
      });
    }

    // STEP 2: CPF nao existe — cadastrar novo
    const params = new URLSearchParams({
      nome: nome.toUpperCase(),
      cpf: cpfLimpo,
      dataNascimento: dataNascimento,
      sexo: sexo,
      telCelular: telLimpo,
      empresa: EMPRESA_ID,
      email: email || 'nao@informado.com',
      endereco: '.',
      cidade: 'GOIANIA',
      bairro: '.',
      cep: '74150020',
      uf: 'GO',
      numero: '0',
      senha: cpfLimpo.substring(0, 6)
    });

    const url = `${BASE}/cliente/cadastrarCliente?${params.toString()}`;
    const resp = await fetch(url, { method: 'POST', headers });

    let data;
    const text = await resp.text();
    try { data = JSON.parse(text); } catch (e) {
      if (resp.ok) data = { resultado: text };
      else return res.status(500).json({ erro: 'Erro API: ' + text.substring(0, 300) });
    }

    if (data.erro) {
      // Se erro é "CPF ja cadastrado", buscar e retornar dados
      if (data.erro.includes('CPF') && data.erro.includes('cadastrado')) {
        const recheck = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filters}&page=0&size=1`, { headers });
        const recheckData = await recheck.json();
        if (recheckData.content && recheckData.content.length > 0) {
          const c = recheckData.content[0];
          return res.status(200).json({
            matricula: c.matricula,
            pessoa: c.pessoa,
            cliente: c.cliente,
            nome: c.nome,
            situacao: c.situacao,
            jaExistia: true
          });
        }
      }
      return res.status(500).json({ erro: data.erro });
    }

    // cadastrarCliente retorna matricula como texto
    if (typeof data.resultado === 'string' && /^\d+$/.test(data.resultado.trim())) {
      // Re-check para pegar dados completos
      const recheck2 = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filters}&page=0&size=1`, { headers });
      const recheckData2 = await recheck2.json();
      if (recheckData2.content && recheckData2.content.length > 0) {
        const c = recheckData2.content[0];
        return res.status(200).json({
          matricula: c.matricula,
          pessoa: c.pessoa,
          cliente: c.cliente,
          nome: c.nome,
          situacao: c.situacao
        });
      }
      return res.status(200).json({ matricula: parseInt(data.resultado.trim()) });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao cadastrar: ' + err.message });
  }
}
