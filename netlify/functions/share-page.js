const https = require('https');
const http = require('http');

function fetchJSON(url) {
  return new Promise(function(resolve, reject) {
    var mod = url.startsWith('https') ? https : http;
    mod.get(url, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

exports.handler = async function(event) {
  var ref = (event.queryStringParameters || {}).ref || '';
  ref = decodeURIComponent(ref).replace(/-/g, ' ').trim();
  var siteUrl = 'https://luxxohomes.com';

  if (!ref) {
    return { statusCode: 302, headers: { Location: siteUrl }, body: '' };
  }

  try {
    var properties = await fetchJSON(siteUrl + '/.netlify/functions/ego-feed');
    
    var found = null;
    for (var i = 0; i < properties.length; i++) {
      var p = properties[i];
      if (p.ref && p.ref.toLowerCase() === ref.toLowerCase()) {
        found = p;
        break;
      }
    }

    if (!found) {
      return { statusCode: 302, headers: { Location: siteUrl }, body: '' };
    }

    var priceStr = found.price ? '\u20ac' + found.price.toLocaleString('nl-NL') : '';
    var title = found.ref + (priceStr ? ' \u2014 ' + priceStr : '') + ' | Luxxo Homes';
    var desc = (found.type || '') + ' in ' + (found.location_detail || found.town || 'Marbella');
    if (found.beds) desc += ' \u00b7 ' + found.beds + ' bed';
    if (found.baths) desc += ' \u00b7 ' + found.baths + ' bath';
    var sqm = found.gross || found.built || 0;
    if (sqm) desc += ' \u00b7 ' + sqm + ' m\u00b2';

    var image = (found.photos && found.photos.length > 0) ? found.photos[0] : '';
    var refSlug = encodeURIComponent(found.ref.replace(/\s+/g, '-'));
    var pageUrl = siteUrl + '/woning/' + refSlug;
    var redirectUrl = siteUrl + '?p=' + refSlug;

    var html = '<!DOCTYPE html><html><head>'
      + '<meta charset="utf-8">'
      + '<title>' + title + '</title>'
      + '<meta property="og:type" content="website">'
      + '<meta property="og:title" content="' + title.replace(/"/g, '&quot;') + '">'
      + '<meta property="og:description" content="' + desc.replace(/"/g, '&quot;') + '">'
      + (image ? '<meta property="og:image" content="' + image + '">' : '')
      + (image ? '<meta property="og:image:width" content="1200">' : '')
      + (image ? '<meta property="og:image:height" content="800">' : '')
      + '<meta property="og:url" content="' + pageUrl + '">'
      + '<meta property="og:site_name" content="Luxxo Homes">'
      + '<meta name="twitter:card" content="summary_large_image">'
      + '<meta name="twitter:title" content="' + title.replace(/"/g, '&quot;') + '">'
      + '<meta name="twitter:description" content="' + desc.replace(/"/g, '&quot;') + '">'
      + (image ? '<meta name="twitter:image" content="' + image + '">' : '')
      + '<meta http-equiv="refresh" content="0;url=' + redirectUrl + '">'
      + '<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FAF8F4;color:#2A2A28;text-align:center;}</style>'
      + '</head><body>'
      + '<div><p style="font-size:18px;">' + found.ref + '</p>'
      + '<p>Doorverwijzen naar <a href="' + redirectUrl + '" style="color:#B8952A;">Luxxo Homes</a>...</p></div>'
      + '</body></html>';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      },
      body: html
    };
  } catch (err) {
    return { statusCode: 302, headers: { Location: siteUrl + '?p=' + encodeURIComponent(ref.replace(/\s+/g, '-')) }, body: '' };
  }
};
