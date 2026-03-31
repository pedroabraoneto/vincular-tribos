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
    const telLimpo = telefone.replace(/\D/g, '');

    // Convert dataNascimento (DD/MM/YYYY) to timestamp
    let tsNascimento;
    if (typeof dataNascimento === 'number') {
      tsNascimento = dataNascimento;
    } else {
      const parts = dataNascimento.split('/');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        tsNascimento = d.getTime();
      } else {
        tsNascimento = new Date(dataNascimento).getTime();
      }
    }

    // Use /cliente/simplificado endpoint (JSON body, fewer required fields)
    const body = {
      nome: nome.toUpperCase(),
      celular: telLimpo,
      dataNascimento: tsNascimento,
      sexo: sexo,
      email: email || ''
    };

    const resp = await fetch(`${BASE}/cliente/simplificado`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'empresaId': EMPRESA_ID,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    let data;
    const text = await resp.text();
    try { data = JSON.parse(text); } catch (e) {
      if (resp.ok) data = { resultado: text };
      else return res.status(500).json({ erro: 'Erro API: ' + text.substring(0, 200) });
    }

    if (data.erro) return res.status(500).json({ erro: data.erro });

    // Extract matricula from simplified response
    if (data.return) {
      return res.status(200).json({
        matricula: data.return.matriculaZW,
        pessoa: data.return.codigoPessoa,
        cliente: data.return.codigoCliente,
        nome: data.return.nome,
        situacao: data.return.situacaoAluno
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ erro: 'Erro ao cadastrar: ' + err.message });
  }
}
