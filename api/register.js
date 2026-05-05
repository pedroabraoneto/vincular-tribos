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

  const cpfLimpo = cpf.replace(/\D/g, '');
  const telLimpo = telefone.replace(/\D/g, '');

  // VALIDACAO ANTI-PLACEHOLDER
  if (telLimpo.includes('99999999') || telLimpo.includes('00000000') || telLimpo.length < 10) {
    return res.status(400).json({ erro: 'Telefone invalido. Use um numero real com DDD.' });
  }

  if (!dataNascimento || dataNascimento.replace(/\D/g, '').length < 8) {
    return res.status(400).json({ erro: 'Data de nascimento obrigatoria no formato DD/MM/AAAA' });
  }

  try {
    // STEP 1: Buscar se CPF ja existe
    const filters = encodeURIComponent(JSON.stringify({ documento: cpfLimpo, empresa: parseInt(EMPRESA_ID) }));
    const checkResp = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filters}&page=0&size=1`, { headers });
    const checkData = await checkResp.json();

    if (checkData.content && checkData.content.length > 0) {
      // CPF JA EXISTE — retornar dados existentes (NUNCA duplicar)
      const c = checkData.content[0];
      console.log(`[register] Match por CPF: mat=${c.matricula}`);
      return res.status(200).json({
        matricula: c.matricula,
        pessoa: c.pessoa,
        cliente: c.cliente,
        nome: c.nome,
        situacao: c.situacao,
        jaExistia: true,
        motivoMatch: 'cpf'
      });
    }

    // STEP 1.5: se email fornecido, buscar por email TAMBEM (fix bug Jamille 017356)
    if (email && email.includes('@')) {
      const emailNorm = email.toLowerCase().trim();
      const filtersEmail = encodeURIComponent(JSON.stringify({ email: emailNorm, empresa: parseInt(EMPRESA_ID) }));
      const respEmail = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filtersEmail}&page=0&size=1`, { headers });
      const dataEmail = await respEmail.json();
      if (dataEmail.content && dataEmail.content.length > 0) {
        const c = dataEmail.content[0];
        console.log(`[register] Match por email: mat=${c.matricula} email=${emailNorm}`);
        return res.status(200).json({
          matricula: c.matricula,
          pessoa: c.pessoa,
          cliente: c.cliente,
          nome: c.nome,
          situacao: c.situacao,
          jaExistia: true,
          motivoMatch: 'email',
          avisoUI: 'Encontramos seu cadastro pelo email! Continuando com seus dados...'
        });
      }
    }

    // STEP 2: CPF e email nao existem — cadastrar novo
    console.log(`[register] Cadastrando novo cliente: cpf=${cpfLimpo}, email=${email || '(vazio)'}`);
    const params = new URLSearchParams({
      nome: nome.toUpperCase(),
      cpf: cpfLimpo,
      dataNascimento: dataNascimento,
      sexo: sexo,
      telCelular: telLimpo,
      empresa: EMPRESA_ID,
      email: email || `${cpfLimpo}@semmail.tribos.com.br`,
      endereco: '.',
      cidade: 'GOIANIA',
      bairro: '.',
      cep: '74150020',
      uf: 'GO',
      numero: '0',
      senha: cpfLimpo.substring(0, 6)
    });

    const resp = await fetch(`${BASE}/cliente/cadastrarCliente?${params.toString()}`, {
      method: 'POST', headers
    });

    let data;
    const text = await resp.text();
    try { data = JSON.parse(text); } catch (e) {
      if (resp.ok) data = { resultado: text };
      else return res.status(500).json({ erro: 'Erro API: ' + text.substring(0, 300) });
    }

    if (data.erro) {
      // Fallback CPF (ja existia)
      if (data.erro.includes('CPF') && data.erro.includes('cadastrado')) {
        const recheck = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filters}&page=0&size=1`, { headers });
        const recheckData = await recheck.json();
        if (recheckData.content && recheckData.content.length > 0) {
          const c = recheckData.content[0];
          return res.status(200).json({
            matricula: c.matricula, pessoa: c.pessoa, cliente: c.cliente,
            nome: c.nome, situacao: c.situacao, jaExistia: true,
            motivoMatch: 'cpf_fallback'
          });
        }
      }
      // NOVO: Fallback EMAIL (defesa em profundidade caso STEP 1.5 nao tenha pego — race condition / cache)
      const erroLower = data.erro.toLowerCase();
      if ((erroLower.includes('email') || erroLower.includes('e-mail')) && erroLower.includes('cadastrad')) {
        if (email && email.includes('@')) {
          const emailNorm = email.toLowerCase().trim();
          const filtersE = encodeURIComponent(JSON.stringify({ email: emailNorm, empresa: parseInt(EMPRESA_ID) }));
          const recheckE = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filtersE}&page=0&size=1`, { headers });
          const recheckDataE = await recheckE.json();
          if (recheckDataE.content && recheckDataE.content.length > 0) {
            const c = recheckDataE.content[0];
            console.log(`[register] Match por email no fallback: mat=${c.matricula} email=${emailNorm}`);
            return res.status(200).json({
              matricula: c.matricula, pessoa: c.pessoa, cliente: c.cliente,
              nome: c.nome, situacao: c.situacao, jaExistia: true,
              motivoMatch: 'email_fallback',
              avisoUI: 'Encontramos seu cadastro pelo email! Continuando com seus dados...'
            });
          }
        }
      }
      return res.status(500).json({ erro: data.erro });
    }

    // Re-check para pegar dados completos
    if (typeof data.resultado === 'string' && /^\d+$/.test(data.resultado.trim())) {
      const recheck2 = await fetch(`${BASE}/cadastro-cliente/consultar?filters=${filters}&page=0&size=1`, { headers });
      const recheckData2 = await recheck2.json();
      if (recheckData2.content && recheckData2.content.length > 0) {
        const c = recheckData2.content[0];
        return res.status(200).json({
          matricula: c.matricula, pessoa: c.pessoa, cliente: c.cliente,
          nome: c.nome, situacao: c.situacao
        });
      }
      return res.status(200).json({ matricula: parseInt(data.resultado.trim()) });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao cadastrar: ' + err.message });
  }
}
