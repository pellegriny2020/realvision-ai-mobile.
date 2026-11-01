
const API_BASE = 'https://realvision-api.tiagos-abreu.workers.dev';
const KEY = 'realvision_mobile_history';

const $ = id => document.getElementById(id);

function load() {
  const list = JSON.parse(localStorage.getItem(KEY) || '[]');
  const area = $('historyList');
  area.innerHTML = '';

  if (!list.length) {
    area.textContent = 'Seus vídeos aparecerão aqui.';
    return;
  }

  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'entry';
    el.textContent = item.prompt;

    const small = document.createElement('small');
    small.textContent = item.date + ' • ' + item.status;
    el.appendChild(small);

    if (item.url) {
      const link = document.createElement('a');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Assistir vídeo';
      el.appendChild(link);
    }

    area.appendChild(el);
  });
}

function save(item) {
  const list = JSON.parse(localStorage.getItem(KEY) || '[]');
  const index = list.findIndex(x => x.id === item.id);
  if (index >= 0) list[index] = item;
  else list.unshift(item);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  load();
}

function findVideoUrl(data) {
  if (!data || typeof data !== 'object') return null;

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' &&
        /^https?:\/\//i.test(value) &&
        /(video|download|output|url)/i.test(key)) {
      return value;
    }
  }

  for (const value of Object.values(data)) {
    const found = findVideoUrl(value);
    if (found) return found;
  }

  return null;
}

$('generate').onclick = async () => {
  const prompt = $('prompt').value.trim();
  const duration = Number($('duration').value);

  if (prompt.length < 8) {
    $('notice').textContent = 'Escreva uma descrição maior.';
    return;
  }

  if (duration > 60) {
    $('notice').textContent =
      'Por enquanto, cada cena pode ter até 60 segundos. A montagem de filmes longos será adicionada depois.';
    return;
  }

  const button = $('generate');
  button.disabled = true;
  $('notice').textContent = 'Enviando pedido ao Magic Hour...';

  try {
    const response = await fetch(API_BASE + '/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: $('style').value + '. ' + prompt,
        duration,
        format: $('format').value,
        name: 'REALVISION AI'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Erro ' + response.status);
    }

    const id = data.id || data.project_id || data.data?.id;

    if (!id) {
      throw new Error('O serviço não retornou o código do projeto: ' + JSON.stringify(data));
    }

    const item = {
      id,
      prompt,
      date: new Date().toLocaleString('pt-BR'),
      status: 'Em geração',
      url: ''
    };

    save(item);
    $('notice').textContent = 'Pedido enviado! Aguardando geração do vídeo...';

    for (let i = 0; i < 36; i++) {
      await new Promise(resolve => setTimeout(resolve, 10000));

      const check = await fetch(
        API_BASE + '/status?id=' + encodeURIComponent(id)
      );

      const result = await check.json();
      const status = String(
        result.status || result.state || result.project_status || ''
      ).toLowerCase();

      const videoUrl = findVideoUrl(result);

      if (videoUrl && /(complete|success|succeed)/i.test(status)) {
        item.status = 'Concluído';
        item.url = videoUrl;
        save(item);

        const video = document.createElement('video');
        video.controls = true;
        video.playsInline = true;
        video.src = videoUrl;
        video.style.width = '100%';
        $('notice').after(video);

        $('notice').textContent = 'Seu vídeo está pronto!';
        return;
      }

      if (/(failed|error|cancelled)/i.test(status)) {
        throw new Error(result.message || result.error || 'Geração não concluída.');
      }

      $('notice').textContent = 'Gerando vídeo... Aguarde.';
    }

    $('notice').textContent =
      'A geração continua. Confira o projeto na sua conta Magic Hour.';
  } catch (error) {
    $('notice').textContent = 'Atenção: ' + error.message;
  } finally {
    button.disabled = false;
  }
};

$('clear').onclick = () => {
  if (confirm('Apagar o histórico deste aparelho?')) {
    localStorage.removeItem(KEY);
    load();
  }
};

let deferred;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferred = event;
  $('install').hidden = false;
});

$('install').onclick = async () => {
  if (!deferred) return;
  deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  $('install').hidden = true;
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}

load();
