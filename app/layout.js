export const metadata = {
  title: 'IoT Blockchain Auth',
  description: 'Blockchain-based authentication for IoT devices',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  );
}
