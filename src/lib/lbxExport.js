import JSZip from 'jszip'
import { padCode } from './business'

/** Brother's .lbx is a proprietary, undocumented format (a ZIP of two XML
 * files, label.xml + prop.xml) that P-touch Editor parses very strictly: a
 * wrong element order or a mismatched text-length attribute and it refuses
 * to open the file, with no error message. This generator is built not by
 * guessing the schema, but by reproducing the exact structure of real,
 * working label.xml files produced by P-touch Editor itself (inspected from
 * genuine exports and from an open-source LBX toolkit's reverse-engineered
 * XSD - https://github.com/jdlien/lbx-utils). Deviating from that structure
 * - element order, single-line XML, charLen matching text length exactly -
 * is the most common cause of a file P-touch Editor silently won't open. */

const PT_PER_MM = 72 / 25.4
const MARGIN_MM = 1
const MARGIN_PT = (MARGIN_MM * PT_PER_MM).toFixed(2)

function pt(mmVal) {
  return `${(mmVal * PT_PER_MM).toFixed(2)}pt`
}

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

let objectSeq = 0
function nextName(prefix) {
  objectSeq += 1
  return `${prefix}${objectSeq}`
}

function textObject({ x, y, width, height, text, size = 7, bold = false, align = 'LEFT' }) {
  const content = String(text ?? '')
  const str = escapeXml(content)
  const weight = bold ? '700' : '400'
  const orgSize = (size * 1.33).toFixed(1)
  const name = nextName('Text')
  const font = `<text:logFont name="Helsinki" width="0" italic="false" weight="${weight}" charSet="0" pitchAndFamily="2"/><text:fontExt effect="NOEFFECT" underline="0" strikeout="0" size="${size}pt" orgSize="${orgSize}pt" textColor="#000000" textPrintColorNumber="1"/>`
  return (
    `<text:text>` +
    `<pt:objectStyle x="${pt(x)}" y="${pt(y)}" width="${pt(width)}" height="${pt(height)}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE">` +
    `<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/>` +
    `<pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>` +
    `<pt:expanded objectName="${name}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/>` +
    `</pt:objectStyle>` +
    `<text:ptFontInfo>${font}</text:ptFontInfo>` +
    `<text:textControl control="AUTOLEN" clipFrame="false" aspectNormal="true" shrink="true" autoLF="false" avoidImage="false"/>` +
    `<text:textAlign horizontalAlignment="${align}" verticalAlignment="TOP" inLineAlignment="BASELINE"/>` +
    `<text:textStyle vertical="false" nullBlock="false" charSpace="0" lineSpace="0" orgPoint="${size}pt" combinedChars="false"/>` +
    `<pt:data>${str}</pt:data>` +
    `<text:stringItem charLen="${[...content].length}"><text:ptFontInfo>${font}</text:ptFontInfo></text:stringItem>` +
    `</text:text>`
  )
}

function barcodeObject({ x, y, width, height, value }) {
  const name = nextName('Barcode')
  return (
    `<barcode:barcode>` +
    `<pt:objectStyle x="${pt(x)}" y="${pt(y)}" width="${pt(width)}" height="${pt(height)}" backColor="#FFFFFF" backPrintColorNumber="0" ropMode="COPYPEN" angle="0" anchor="TOPLEFT" flip="NONE">` +
    `<pt:pen style="NULL" widthX="0.5pt" widthY="0.5pt" color="#000000" printColorNumber="1"/>` +
    `<pt:brush style="NULL" color="#000000" printColorNumber="1" id="0"/>` +
    `<pt:expanded objectName="${name}" ID="0" lock="0" templateMergeTarget="LABELLIST" templateMergeType="NONE" templateMergeID="0" linkStatus="NONE" linkID="0"/>` +
    `</pt:objectStyle>` +
    `<barcode:barcodeStyle protocol="CODE128" lengths="0" zeroFill="false" barWidth="0.8pt" barRatio="1:3" humanReadable="true" humanReadableAlignment="LEFT" checkDigit="false" autoLengths="true" margin="true" sameLengthBar="false" bearerBar="false"/>` +
    `<pt:data>${escapeXml(value)}</pt:data>` +
    `</barcode:barcode>`
  )
}

function buildLabelXml({ widthMm, heightMm, objectsXml }) {
  const bgWidth = widthMm - 2 * MARGIN_MM
  const bgHeight = heightMm - 2 * MARGIN_MM
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<pt:document xmlns:pt="http://schemas.brother.info/ptouch/2007/lbx/main" xmlns:style="http://schemas.brother.info/ptouch/2007/lbx/style" xmlns:text="http://schemas.brother.info/ptouch/2007/lbx/text" xmlns:draw="http://schemas.brother.info/ptouch/2007/lbx/draw" xmlns:image="http://schemas.brother.info/ptouch/2007/lbx/image" xmlns:barcode="http://schemas.brother.info/ptouch/2007/lbx/barcode" xmlns:database="http://schemas.brother.info/ptouch/2007/lbx/database" xmlns:table="http://schemas.brother.info/ptouch/2007/lbx/table" version="1.9" generator="com.brother.PtouchEditor">` +
    `<pt:body currentSheet="Sheet 1" direction="LTR">` +
    `<style:sheet name="Sheet 1">` +
    `<style:paper media="0" width="${pt(widthMm)}" height="${pt(heightMm)}" marginLeft="${MARGIN_PT}pt" marginTop="${MARGIN_PT}pt" marginRight="${MARGIN_PT}pt" marginBottom="${MARGIN_PT}pt" orientation="landscape" autoLength="false" monochromeDisplay="true" printColorDisplay="false" printColorsID="0" paperColor="#FFFFFF" paperInk="#000000" split="1" format="" backgroundTheme="0" printerID="13620" printerName="Brother QL-800"/>` +
    `<style:cutLine regularCut="0pt" freeCut=""/>` +
    `<style:backGround x="${MARGIN_PT}pt" y="${MARGIN_PT}pt" width="${pt(bgWidth)}" height="${pt(bgHeight)}" brushStyle="NULL" brushId="0" userPattern="NONE" userPatternId="0" color="#000000" printColorNumber="1" backColor="#FFFFFF" backPrintColorNumber="0"/>` +
    `<pt:objects>${objectsXml}</pt:objects>` +
    `</style:sheet>` +
    `</pt:body>` +
    `</pt:document>`
  )
}

function buildPropXml() {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<meta:properties xmlns:meta="http://schemas.brother.info/ptouch/2007/lbx/meta" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">` +
    `<meta:appName>com.brother.PtouchEditor</meta:appName><dc:title></dc:title><dc:subject></dc:subject><dc:creator></dc:creator><meta:keyword></meta:keyword><dc:description></dc:description><meta:template></meta:template>` +
    `<dcterms:created>${now}</dcterms:created><dcterms:modified>${now}</dcterms:modified><meta:lastPrinted></meta:lastPrinted><meta:modifiedBy></meta:modifiedBy><meta:revision>1</meta:revision><meta:editTime>0</meta:editTime><meta:numPages>1</meta:numPages><meta:numWords>0</meta:numWords><meta:numChars>0</meta:numChars><meta:security>0</meta:security>` +
    `</meta:properties>`
  )
}

/** Lays out one label's objects to echo the physical label format already
 * in use (barcode+price on top, shop name, description, date), scaled to
 * whatever widthMm/heightMm the chosen media actually is. */
function buildObjectsXml({ widthMm, heightMm, shopName, codeText, description, priceText, dateText }) {
  const usableW = widthMm - 2 * MARGIN_MM
  const usableH = heightMm - 2 * MARGIN_MM
  const topRowH = usableH * 0.45
  const barcodeW = usableW * 0.6
  const priceW = usableW - barcodeW - 1
  const rowH = (usableH - topRowH) / 3

  const objects = []
  objects.push(barcodeObject({ x: MARGIN_MM, y: MARGIN_MM, width: barcodeW, height: topRowH, value: codeText }))
  objects.push(
    textObject({
      x: MARGIN_MM + barcodeW + 1,
      y: MARGIN_MM,
      width: priceW,
      height: topRowH,
      text: priceText,
      size: Math.max(10, Math.round(topRowH * 1.4)),
      bold: true,
      align: 'RIGHT',
    }),
  )
  let y = MARGIN_MM + topRowH
  if (shopName) {
    objects.push(textObject({ x: MARGIN_MM, y, width: usableW, height: rowH, text: shopName.toUpperCase(), size: Math.max(6, Math.round(rowH * 1.3)), bold: true }))
  }
  y += rowH
  if (description) {
    objects.push(textObject({ x: MARGIN_MM, y, width: usableW, height: rowH, text: description.toUpperCase(), size: Math.max(6, Math.round(rowH * 1.3)), bold: true }))
  }
  y += rowH
  if (dateText) {
    objects.push(textObject({ x: MARGIN_MM, y, width: usableW, height: rowH, text: dateText, size: Math.max(5, Math.round(rowH * 1.1)), bold: false }))
  }
  return objects.join('')
}

/** Builds one .lbx (a ZIP Blob) for a single article. */
export async function buildArticleLbx({ widthMm, heightMm, shopName, code, description, price, date, vendorName }) {
  const codeText = padCode(code)
  const dateAndVendor = vendorName ? `${date}  ·  ${vendorName}` : date
  const objectsXml = buildObjectsXml({
    widthMm,
    heightMm,
    shopName,
    codeText,
    description,
    priceText: price,
    dateText: dateAndVendor,
  })
  const zip = new JSZip()
  zip.file('label.xml', buildLabelXml({ widthMm, heightMm, objectsXml }))
  zip.file('prop.xml', buildPropXml())
  return zip.generateAsync({ type: 'blob', mimeType: 'application/octet-stream' })
}

/** Builds a .zip bundle containing one .lbx per article, for batch export. */
export async function buildLbxBundle(articles) {
  const outer = new JSZip()
  for (const a of articles) {
    const blob = await buildArticleLbx(a)
    outer.file(a.filename, blob)
  }
  return outer.generateAsync({ type: 'blob' })
}
