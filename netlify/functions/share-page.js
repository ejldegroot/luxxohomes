const https = require('https');
const http = require('http');

function fetchFeed() {
  return new Promise(function(resolve, reject) {
    var url = 'http://feeds.transporter.janeladigital.com/423E0F5F-30FC-4E01-8FE1-99BD7E14B021/0500048808.xml';
    http.get(url, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() { resolve(data); });
    }).on('error', reject);
  });
}

function getTag(xml, tag) {
  var m = xml.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>', 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function getImageUrls(p) {
  var imgs = [];
  var re = /<image[^>]*>([\s\S]*?)<\/image>/gi;
  var m;
  while ((m = re.exec(p)) !== null) {
    var url = getTag(m[1], 'url');
    if (url) imgs.push(url);
  }
  return imgs;
}

function cleanRef(r) {
  return r.replace(/#ref:\s*/i, '').replace(/\s+(sold|portfolio|soon)$/i, '').trim();
}

exports.handler = async function(event) {
  var ref = (event.queryStringParameters || {}).ref || '';
  ref = decodeURIComponent(ref).replace(/-/g, ' ').trim();
  
  if (!ref) {
    return { statusCode: 302, headers: { Location: 'https://luxxohomes.com' }, body: '' };
  }

  try {
    var xml = await fetchFeed();
    var properties = xml.split(/<property>/i).slice(1);
    var found = null;

    for (var i = 0; i < properties.length; i++) {
      var p = properties[i];
      var rawRef = getTag(p, 'reference');
      var clean = cleanRef(rawRef);
      if (clean.toLowerCase() === ref.toLowerCase()) {
        var price = parseInt(getTag(p, 'price')) || 0;
        var type = getTag(p, 'type');
        var town = getTag(p, 'town');
        var loc = getTag(p, 'location_detail');
        var beds = getTag(p, 'beds');
        var baths = getTag(p, 'baths');
        var built = parseInt(getTag(p, 'built')) || 0;
        var imgs = getImageUrls(p);
        
        // Get gross area from features
        var featBlock = (p.match(/<features>([\s\S]*?)<\/features>/i) || ['',''])[1];
        var feats = [];
        var fm;
        var fre = /<feature[^>]*>([\s\S]*?)<\/feature>/gi;
        while ((fm = fre.exec(featBlock)) !== null) {
          feats.push(fm[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim());
        }
        var gross = 0;
        feats.forEach(function(f) {
          var gm = f.match(/^([\d.]+)\s*gross\s*area$/i);
          if (gm) gross = Math.round(parseFloat(gm[1]));
        });

        // Get description
        var descBlock = (p.match(/<descriptions?>([\s\S]*?)<\/descriptions?>/i) || ['',''])[1];
        var descEn = '';
        var langBlocks = descBlock.split(/<language/i);
        for (var j = 1; j < langBlocks.length; j++) {
          if (/code\s*=\s*["']en["']/i.test(langBlocks[j])) {
            descEn = getTag(langBlocks[j], 'description').substring(0, 200);
            break;
          }
        }

        found = {
          ref: clean,
          price: price,
          type: type,
          town: town,
          location: loc || town,
          beds: beds,
          baths: baths,
          sqm: gross || built,
          image: imgs[0] || '',
          desc: descEn.replace(/\r?\n/g, ' ').replace(/"/g, '&quot;')
        };
        break;
      }
    }

    if (!found) {
      return { statusCode: 302, headers: { Location: 'https://luxxohomes.com' }, body: '' };
    }

    var priceStr = found.price ? '€' + found.price.toLocaleString('nl-NL') : '';
    var title = found.ref + (priceStr ? ' — ' + priceStr : '') + ' | Luxxo Homes';
    var description = found.type + ' in ' + found.location + (found.beds ? ' · ' + found.beds + ' bed' : '') + (found.baths ? ' · ' + found.baths + ' bath' : '') + (found.sqm ? ' · ' + found.sqm + ' m²' : '');
    var refSlug = encodeURIComponent(found.ref.replace(/\s+/g, '-'));
    var siteUrl = 'https://luxxohomes.com/woning/' + refSlug;

    var html = '<!DOCTYPE html><html><head>'
      + '<meta charset="utf-8">'
      + '<title>' + title + '</title>'
      + '<meta property="og:type" content="website">'
      + '<meta property="og:title" content="' + title + '">'
      + '<meta property="og:description" content="' + description + '">'
      + '<meta property="og:image" content="' + found.image + '">'
      + '<meta property="og:image:width" content="1200">'
      + '<meta property="og:image:height" content="630">'
      + '<meta property="og:url" content="' + siteUrl + '">'
      + '<meta property="og:site_name" content="Luxxo Homes">'
      + '<meta name="twitter:card" content="summary_large_image">'
      + '<meta name="twitter:title" content="' + title + '">'
      + '<meta name="twitter:description" content="' + description + '">'
      + '<meta name="twitter:image" content="' + found.image + '">'
      + '<meta http-equiv="refresh" content="0;url=https://luxxohomes.com?p=' + refSlug + '">'
      + '<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FAF8F4;color:#333;}</style>'
      + '</head><body>'
      + '<p>Doorverwijzen naar <a href="https://luxxohomes.com?p=' + refSlug + '">Luxxo Homes</a>...</p>'
      + '</body></html>';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: html
    };
  } catch (err) {
    return { statusCode: 302, headers: { Location: 'https://luxxohomes.com' }, body: '' };
  }
};
