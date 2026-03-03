export default function SnapTradeCallbackPage() {
  return (
    <html>
      <body>
        <p>Connection complete. This window will close automatically...</p>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Notify the parent window that connection is done
              if (window.opener) {
                window.opener.postMessage({ type: 'SNAPTRADE_CONNECTED' }, '*');
              }
              window.close();
            `,
          }}
        />
      </body>
    </html>
  );
}
