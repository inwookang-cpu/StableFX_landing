import './globals.css';

export const metadata = {
  title: 'FX Date Calculator | StableFX',
  description: '외환 파생상품 Date Rule 계산기 - Fair Price for Your FX',
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
