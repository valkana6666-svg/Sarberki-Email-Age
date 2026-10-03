(() => {
  const button = document.getElementById('pushover_test');
  const status = document.getElementById('pushover_status');
  const panel = document.getElementById('pushover_panel');
  if (!button || !status || !panel) return;
  if (location.origin !== 'https://leafy-chimera-2403e5.netlify.app') {
    panel.hidden = true;
    return;
  }
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Tesztértesítés küldése…';
    try {
      const response = await fetch('/api/pushover-test', {
        method: 'POST', headers: {'content-type': 'application/json'},
        body: JSON.stringify({event: 'connection-test'})
      });
      if (response.status === 429) throw new Error('Új teszt legkorábban 3 perc múlva küldhető.');
      const data = await response.json();
      if (!response.ok || !data.ok) {
        const errors = {
          MISSING_CONFIGURATION: 'Hiányzó Netlify-változó: ' + (data.missing || []).join(', '),
          INVALID_CONFIGURATION: 'A Pushover kulcsok formátuma hibás.',
          PUSHOVER_REJECTED: 'A Pushover elutasította a küldést. Ellenőrizni kell a User Key és API Token értékét.',
          PUSHOVER_UNAVAILABLE: 'A küldés eredménye bizonytalan. Ellenőrizd a telefont újabb teszt előtt.'
        };
        throw new Error(errors[data.code] || 'A tesztértesítés küldése sikertelen.');
      }
      status.textContent = 'Pushover API: sikeres (status=1). ' + data.message +
        ' Kérésazonosító: ' + data.requestId + ' · Build: ' + data.deployedCommit.slice(0, 7) +
        ' · A telefonos megérkezés külön ellenőrizhető.';
    } catch (error) {
      status.textContent = error.message || 'Hálózati hiba; ellenőrizd a telefont újabb teszt előtt.';
    } finally { button.disabled = false; }
  });
})();
