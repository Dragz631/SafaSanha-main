import confetti from 'canvas-confetti';

/**
 * Toca efeito sonoro de caixa registradora / moedas caindo ("Ka-ching!")
 * Utiliza 100% Web Audio API nativa do navegador (sem arquivos externos, funciona offline e sem lag)
 */
export function playCashChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Primeiro tom: Moeda tinindo (agudo e brilhante)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1046.5, now); // C6
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.08); // E6

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Segundo tom: Caixa registradora "Ka-Ching" (toca 70ms depois)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760.0, now + 0.07); // A6
    osc2.frequency.exponentialRampToValueAtTime(2637.0, now + 0.15); // E7

    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.35, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.5);

    // Terceiro tom: Ressonância dourada
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(3135.96, now + 0.12); // G7

    gain3.gain.setValueAtTime(0.001, now);
    gain3.gain.setValueAtTime(0.25, now + 0.12);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.12);
    osc3.stop(now + 0.65);
  } catch (err) {
    console.warn('Efeito sonoro de dinheiro não suportado no dispositivo:', err);
  }
}

/**
 * Dispara confetes com notas de dinheiro (💵), moedas de ouro (🪙) e sacos de dinheiro (💰)
 */
export function triggerMoneyConfetti(): void {
  try {
    // Emojis de dinheiro e ouro
    const moneyShapes = [
      confetti.shapeFromText({ text: '💵', scalar: 2 }),
      confetti.shapeFromText({ text: '🪙', scalar: 2 }),
      confetti.shapeFromText({ text: '💰', scalar: 2 }),
      confetti.shapeFromText({ text: '💸', scalar: 2 }),
      confetti.shapeFromText({ text: '✨', scalar: 1.8 }),
    ];

    // Explosão central de dinheiro
    confetti({
      shapes: moneyShapes,
      particleCount: 28,
      spread: 80,
      startVelocity: 35,
      gravity: 0.7,
      origin: { y: 0.65, x: 0.5 },
      ticks: 200,
    });

    // Chuva de confetes dourados e esmeraldas nas laterais
    confetti({
      particleCount: 35,
      angle: 60,
      spread: 55,
      origin: { x: 0.1, y: 0.75 },
      colors: ['#10b981', '#fbbf24', '#f59e0b', '#22c55e', '#34d399'],
    });

    confetti({
      particleCount: 35,
      angle: 120,
      spread: 55,
      origin: { x: 0.9, y: 0.75 },
      colors: ['#10b981', '#fbbf24', '#f59e0b', '#22c55e', '#34d399'],
    });
  } catch {
    // Fallback padrão se shapeFromText não for suportado
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#10b981', '#fbbf24', '#f59e0b', '#22c55e'],
    });
  }
}
