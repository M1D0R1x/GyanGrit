<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" 
                xmlns:html="http://www.w3.org/TR/REC-html40"
                xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
                xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" version="1.0" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <title>GyanGrit XML Sitemap</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style type="text/css">
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            color: #c9d1d9;
            background-color: #0d1117;
            margin: 0;
            padding: 40px;
          }
          h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 700;
          }
          p {
            color: #8b949e;
            font-size: 15px;
            margin-bottom: 24px;
          }
          a {
            color: #58a6ff;
            text-decoration: none;
          }
          a:hover {
            text-decoration: underline;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.08);
          }
          th, td {
            text-align: left;
            padding: 14px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            font-size: 14px;
          }
          th {
            background: rgba(255, 255, 255, 0.05);
            color: #ffffff;
            font-weight: 600;
          }
          tr:hover {
            background-color: rgba(255, 255, 255, 0.05);
          }
        </style>
      </head>
      <body>
        <h1>GyanGrit XML Sitemap</h1>
        <p>This is the central index used by search engines (like Google) to discover content on GyanGrit.</p>
        <table>
          <thead>
            <tr>
              <th>URL Object</th>
              <th>Priority</th>
              <th>Change Frequency</th>
              <th>Last Modified</th>
            </tr>
          </thead>
          <tbody>
            <xsl:variable name="lower" select="'abcdefghijklmnopqrstuvwxyz'"/>
            <xsl:variable name="upper" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'"/>
            <xsl:for-each select="sitemap:urlset/sitemap:url">
              <tr>
                <td>
                  <xsl:variable name="itemURL">
                    <xsl:value-of select="sitemap:loc"/>
                  </xsl:variable>
                  <a href="{$itemURL}">
                    <xsl:value-of select="sitemap:loc"/>
                  </a>
                </td>
                <td>
                  <xsl:value-of select="sitemap:priority"/>
                </td>
                <td>
                  <xsl:value-of select="sitemap:changefreq"/>
                </td>
                <td>
                  <xsl:value-of select="sitemap:lastmod"/>
                </td>
              </tr>
            </xsl:for-each>
          </tbody>
        </table>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
