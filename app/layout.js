export const metadata = {
  title: 'Blockchain IoT Authentication',
  description: 'Lightweight blockchain-based authentication framework for IoT devices using dynamic trust tokens',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', backgroundColor: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  );
}
