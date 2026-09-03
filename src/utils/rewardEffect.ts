import confetti from 'canvas-confetti';

export interface FloatingParticle {
  id: number;
  emoji: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  scale: number;
}

export interface CelebrationEventData {
  count: number;
  clientName?: string;
  originX: number;
  originY: number;
  particles: FloatingParticle[];
}

type CelebrationListener = (data: CelebrationEventData) => void;
const listeners: Set<CelebrationListener> = new Set();

export const onRewardTriggered = (fn: any) => onCelebration(fn);
export const onCelebration = (fn: CelebrationListener) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/**
 * Síntese acústica realista de caixa registradora e moedas metálicas caindo
 */
export const playChaChingSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // 1. Som de clique metálico inicial da gaveta abrindo
    const oscClick = ctx.createOscillator();
    const gainClick = ctx.createGain();
    oscClick.type = 'triangle';
    oscClick.frequency.setValueAtTime(440, now);
    oscClick.frequency.exponentialRampToValueAtTime(880, now + 0.04);
    gainClick.gain.setValueAtTime(0.2, now);
    gainClick.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    oscClick.connect(gainClick);
    gainClick.connect(ctx.destination);
    oscClick.start(now);
    oscClick.stop(now + 0.08);

    // 2. Primeira moeda de ouro tilintando (B5 -> E6)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now + 0.02);
    osc1.frequency.exponentialRampToValueAtTime(1318.51, now + 0.1);
    gain1.gain.setValueAtTime(0.28, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now + 0.02);
    osc1.stop(now + 0.38);

    // 3. Sino alto da caixa registradora (E6 -> B6 cha-ching)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(2093.0, now + 0.25); // C7 brilhante
    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.setValueAtTime(0.35, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.7);

    // 4. Moedas rolando e tilintando no final
    setTimeout(() => {
      try {
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        const t = ctx.currentTime;
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(1567.98, t); // G6
        gain3.gain.setValueAtTime(0.18, t);
        gain3.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        osc3.start(t);
        osc3.stop(t + 0.25);
      } catch (_e) {}
    }, 150);
  } catch (_e) {}
};

/**
 * Dispara a grande animação visual de dinheiro (moedas, notas, confetes e som)
 * Chamada exatamente ao clicar em "Abrir Zap com Texto de Entrega" ou "Salvar sem abrir Zap"
 */
export const triggerCoinBurst = (
  count: number = 1,
  clientName?: string,
  targetElementOrEvent?: React.MouseEvent | HTMLElement | null
) => {
  // Som realista de caixa e moedas
  playChaChingSound();

  // Vibração tátil no celular do entregador
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 40, 80]);
    }
  } catch (_e) {}

  // Posição de origem (onde o usuário clicou)
  let originScreenX = window.innerWidth / 2;
  let originScreenY = window.innerHeight * 0.7;

  if (targetElementOrEvent) {
    if ('clientX' in targetElementOrEvent && targetElementOrEvent.clientX > 0) {
      originScreenX = targetElementOrEvent.clientX;
      originScreenY = targetElementOrEvent.clientY;
    } else if (targetElementOrEvent instanceof HTMLElement) {
      const rect = targetElementOrEvent.getBoundingClientRect();
      originScreenX = rect.left + rect.width / 2;
      originScreenY = rect.top + rect.height / 2;
    }
  }

  const normX = Math.max(0.1, Math.min(0.9, originScreenX / window.innerWidth));
  const normY = Math.max(0.1, Math.min(0.95, originScreenY / window.innerHeight));

  // 1. Explosão de Confetes Dourados e Notas Verdes em 2 Estágios (Efeito Rico)
  try {
    // Tiro central
    confetti({
      particleCount: 35,
      spread: 60,
      startVelocity: 32,
      origin: { x: normX, y: normY },
      colors: ['#fbbf24', '#f59e0b', '#10b981', '#34d399', '#fef08a', '#ffffff'],
      shapes: ['circle', 'square'],
      ticks: 90,
      gravity: 0.85,
      scalar: 1.15,
      disableForReducedMotion: true,
    });

    // Tiro secundário lateral (estrelas e moedas)
    setTimeout(() => {
      try {
        confetti({
          particleCount: 25,
          angle: 60,
          spread: 55,
          startVelocity: 28,
          origin: { x: Math.max(0.05, normX - 0.1), y: normY },
          colors: ['#f59e0b', '#10b981', '#ffd700'],
          ticks: 80,
          gravity: 0.9,
          scalar: 1.0,
        });
        confetti({
          particleCount: 25,
          angle: 120,
          spread: 55,
          startVelocity: 28,
          origin: { x: Math.min(0.95, normX + 0.1), y: normY },
          colors: ['#f59e0b', '#10b981', '#ffd700'],
          ticks: 80,
          gravity: 0.9,
          scalar: 1.0,
        });
      } catch (_e) {}
    }, 120);
  } catch (_e) {}

  // 2. Gera partículas visuais físicas de emojis (🪙, 💵, 💰, ✨, 💸)
  const emojis = ['🪙', '💵', '💰', '✨', '💸', '🪙', '💵'];
  const particles: FloatingParticle[] = [];
  const particleCount = 14;

  for (let i = 0; i < particleCount; i++) {
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
    const speed = 120 + Math.random() * 180;
    particles.push({
      id: Date.now() + i + Math.random(),
      emoji: emojis[i % emojis.length],
      x: originScreenX,
      y: originScreenY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 150, // Força para cima
      rotation: Math.random() * 360,
      scale: 0.9 + Math.random() * 0.5,
    });
  }

  // Notifica todos os ouvintes visuais
  listeners.forEach((fn) =>
    fn({
      count,
      clientName,
      originX: originScreenX,
      originY: originScreenY,
      particles,
    })
  );
};
