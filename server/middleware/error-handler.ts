import { Request, Response, NextFunction } from 'express';

export const customErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  
  console.error('Server Error:', {
    status,
    message,
    path: req.path,
    method: req.method,
    stack: err.stack
  });
  
  // For API requests, send professional JSON error without Replit references
  if (req.path.startsWith('/api')) {
    return res.status(status).json({
      error: 'Service temporarily unavailable',
      message: 'Our event management system is undergoing maintenance. Please try again shortly.',
      status
    });
  }
  
  // For web requests, serve branded error page that hides Replit
  const errorHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>System Maintenance - Ievolve Event Management</title>
      <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px;
          }
          .container {
              background: white; border-radius: 12px; padding: 40px; max-width: 500px; width: 100%;
              text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .logo {
              background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 15px 30px;
              border-radius: 8px; font-size: 18px; font-weight: bold; margin-bottom: 30px; display: inline-block;
          }
          h1 { color: #333; font-size: 28px; margin-bottom: 15px; }
          .subtitle { color: #666; font-size: 18px; margin-bottom: 30px; }
          .message { color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
          .retry-btn {
              background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none;
              padding: 15px 30px; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;
              margin-right: 15px;
          }
          .contact-btn {
              background: transparent; color: #667eea; border: 2px solid #667eea;
              padding: 13px 30px; border-radius: 8px; font-size: 16px; font-weight: 600; 
              text-decoration: none; display: inline-block;
          }
          .auto-refresh { margin-top: 20px; color: #888; font-size: 14px; }
          @media (max-width: 480px) {
              .retry-btn, .contact-btn { display: block; width: 100%; margin: 10px 0; }
          }
      </style>
  </head>
  <body>
      <div class="container">
          <div class="logo">IEVOLVE EVENT MANAGEMENT</div>
          <h1>System Maintenance</h1>
          <div class="subtitle">Chief Minister Trophy - Tamil Nadu</div>
          <div class="message">
              Our event management system is temporarily unavailable. We're working to restore service quickly.
          </div>
          <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
          <a href="mailto:support@greatorsoftware.com" class="contact-btn">Contact Support</a>
          <div class="auto-refresh">
              Automatically retrying in <span id="countdown">30</span> seconds...
          </div>
      </div>
      <script>
          let countdown = 30;
          setInterval(() => {
              countdown--; 
              document.getElementById('countdown').textContent = countdown;
              if (countdown <= 0) window.location.reload();
          }, 1000);
      </script>
  </body>
  </html>`;
  
  res.status(status).send(errorHtml);
};

export const handle404 = (req: Request, res: Response) => {
  // For API 404s
  if (req.path.startsWith('/api')) {
    return res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found.',
      path: req.path
    });
  }
  
  // For web 404s, redirect to main app (SPA handling)
  res.redirect('/');
};