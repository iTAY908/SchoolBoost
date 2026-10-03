// Worker 2 — shared visual language (cube palette mirrors the backend CUBE_META)
export const colors = {
  bg: '#0D0D14',
  bgElevated: '#16161F',
  card: '#1C1C28',
  cardBorder: '#2A2A3A',
  text: '#E7E7F2',
  textDim: '#9A9AB0',
  primary: '#6C5CE7',
  primaryDim: '#4B3FB8',
  success: '#00B894',
  danger: '#D63031',
  warning: '#FDCB6E',
  cube: {
    housing: '#6C5CE7',
    essentials: '#00B894',
    savings: '#0984E3',
    investments: '#E17055',
    emergency: '#D63031',
    lifestyle: '#FDCB6E',
  } as Record<string, string>,
};

export const spacing = (n: number) => n * 8;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 };

export const font = {
  h1: { fontSize: 30, fontWeight: '800' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '500' as const },
  small: { fontSize: 13, fontWeight: '500' as const },
};
