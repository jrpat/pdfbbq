/**********************************************************************/
/**/ const D=document, B=D.body, E=Element, LS=localStorage         /**/
/**/ const $=D.querySelector.bind(D), $$=D.querySelectorAll.bind(D) /**/
/**/ const U = x => x===undefined                                   /**/
/**/ const tojson = x => U(x) ? "" : JSON.stringify(x)              /**/
/**/ const unjson = str => U(str) ? undefined : JSON.parse(str)     /**/
/**/ const db = {set: (k,v) => LS.setItem(k, tojson(v)),            /**/
/**/             get: (k) => unjson(LS.getItem(k)),                 /**/
/**/             del: (k) => LS.removeItem(k),                      /**/
/**/             raw: LS}                                           /**/
/**/ const debounce = (ms, f) => {let t; return (...args) => {      /**/
/**/   clearTimeout(t); t = setTimeout(f.bind(null, ...args), ms)}} /**/
/**********************************************************************/

import * as PDF from 'https://cdn.skypack.dev/pdf-lib'
import Split from 'https://cdn.skypack.dev/split.js'
const CM = CodeMirror

window.PDF = PDF
const AsyncFunction = (async function(){}).constructor

const ua = (function() {
  const u = navigator.userAgent
  let chrome = /Chrome/.test(u)
  let safari = !chrome && /AppleWebKit/.test(u)
  let mac = /Mac/.test(navigator.platform)
  return {chrome, safari, mac}
})()

const MOD = ua.mac ? 'Cmd' : 'Ctrl'

$$('.mod').forEach(e => e.innerHTML = e.innerHTML.replace('Cmd', MOD))


// See https://codemirror.net/examples/autocompletion/
const completePropertyAfter = ["PropertyName", ".", "?."]
const dontCompleteIn = ["TemplateString", "LineComment", "BlockComment",
                        "VariableDefinition", "PropertyDefinition"]
function completeProperties(from, object) {
  let options = []
  for (let name in object) {
    options.push({
      label: name,
      type: typeof object[name] == "function" ? "function" : "variable"
    })
  }
  return { from, options, validFor: /^[\w$]*$/ }
}
function completeFromObject(obj) {
  return function(c) {
    let nodeBefore = CM.lang.syntaxTree(c.state).resolveInner(c.pos, -1)
    if (completePropertyAfter.includes(nodeBefore.name) &&
      nodeBefore.parent?.name == "MemberExpression") {
      let object = nodeBefore.parent.getChild("Expression")
      if (object?.name == "VariableName") {
        let from = /\./.test(nodeBefore.name) ? nodeBefore.to : nodeBefore.from
        let variableName = c.state.sliceDoc(object.from, object.to)
        if (typeof obj[variableName] == "object")
          return completeProperties(from, obj[variableName])
      }
    } else if (nodeBefore.name == "VariableName") {
      return completeProperties(nodeBefore.from, obj)
    } else if (c.explicit && !dontCompleteIn.includes(nodeBefore.name)) {
      return completeProperties(c.pos, obj)
    }
    return null
  }
}

function download(filename, text) {
  if (!text) { return alert('No file') }
  let a = document.createElement('a')
  a.download=filename; a.target='_blank'
  a.href = `${encodeURI(text)}`
  a.click()
}

function msg(m) {
  clearTimeout(msg.t)
  let e = $('#msg')
  e.innerHTML = m
  e.classList.add('show')
  msg.t = setTimeout(() => e.classList.remove('show'), 5000)
}

window.dlcode = () => {
  let name = current_file+'.js' 
  download(name, `data:text/plain,${getcode()}`)
  msg('✓ Downloaded '+name)
}
window.dlpdf = () => {
  let name = current_file+'.pdf'
  download(name, $('#view-iframe').src)
  msg('✓ Downloaded '+name)
}

window.printpdf = () => {
  let iframe = $('#view-iframe')
  if (ua.safari) {
    // Safari adds a (seemingly) unavoidable bottom margin when
    // printing a PDF from an iframe. If we find a way to avoid
    // it, we can happily remove this 'if' block.
    let win = open(iframe.src, '_blank')
    setTimeout(() => { win.print(); win.close() }, 400)
  } else {
    iframe.contentWindow.print()
  }
}

const savemsg = '👍 PDFBBQ automatically saves your work.'

D.addEventListener('keydown', e => {
  if (ua.mac ? e.metaKey : e.ctrlKey) {
    if (e.key == 's') { e.preventDefault(); msg(savemsg) }
    if (e.key == 'p') { e.preventDefault(); printpdf() }
    if (e.key == 'Enter') { e.preventDefault(); draw() }
  }
})


window.intro = `// Welcome to PDF BBQ!
//
// You can use these shortcuts to get around:
//
//     ${MOD}+Enter   Run your code
//     ${MOD}+P       Print the PDF
//
//  These variables are predefined for you:
//
//     PDF   The PDFLib module
//     doc   The PDFDocument instance
//
//  Hover the [Help] menu above for more
//  variables, functions, and shortcuts!
//
//  When you're ready, delete this comment
//  and start cooking up a PDF! ♨️

let page = doc.addPage(PDF.PageSizes.Letter)
let {width, height} = page.getSize()

let purple = PDF.rgb(0.4, 0.2, 0.6)
let white = PDF.rgb(1, 1, 1)

let head_size = width/4
let eye_size = width/32
let mouth_size = width/7

let cx = width/2
let cy = height/2 + height/8

page.drawCircle({
  x: cx,
  y: cy,
  size: head_size,
  color: purple
})

page.drawCircle({
  x: cx,
  y: cy - mouth_size/8,
  size: mouth_size,
  color: white
})
page.drawEllipse({
  x: cx,
  y: cy + mouth_size/8,
  xScale: mouth_size*1.25,
  yScale: mouth_size/1.25,
  color: purple
})

let draw_eye = (offset) => {
  page.drawEllipse({
    x: cx + eye_size*3*offset,
    y: cy + eye_size*2.5,
    xScale: eye_size,
    yScale: eye_size*1.5,
    color: white
  })
}
draw_eye(1)
draw_eye(-1)
`

let ed
const getcode = () => ed.state.doc.toString()

let current_file = db.get('current_file') || 'pdfbbq'
let files = db.get('files') || {}

window.newintro = () => {
  let intros = Object.keys(files).filter(f => f.indexOf('intro') == 0)
  let name = `intro-${intros.length}`
  newfile(name, intro)
}

window.newfile = (name, content) => {
  name = name || prompt('New File Name:')
  if (!name) return
  if (files[name]) {
    if (!confirm(`File ${name} exists. Erase it?`)) return
  }
  db.set(`file__${name}`, content || '')
  loadfile(name)
}

window.loadfile = (name) => {
  let code = db.get(`file__${name}`) || ''
  current_file = name
  if (!files[current_file]) { files[current_file] = {} }
  files[current_file].t = Date.now()
  ed.dispatch({
    changes: {from:0, to:ed.state.doc.length, insert:code}
  })
  setTimeout(populate_recents, 2000)
  draw()
}

window.rename = () => {
  let name = prompt('Rename File To:')
  if (!name) return
  let files = db.get('files')
}

function populate_recents() {
  let times = Object.entries(db.get('files') || {})
  times.sort((a, b) => a[1].t > b[1].t ? -1 : 1)
  $('#mru').innerHTML = ''
  for (let [name, _] of times) {
    let b = document.createElement('b')
    b.onclick = () => loadfile(name)
    b.innerText = name
    mru.append(b)
  }
}

async function init() {
  Split(['#code', '#view'], {
    gutterSize: 5,
    sizes: db.get('splitsize') || [50, 50],
    onDragEnd: sizes => db.set('splitsize', sizes)
  })

  const doc = await PDF.PDFDocument.create()
  const PPI = PDF.PageSizes.Letter[0] / 8.5
  const in2pt = n => n * PPI
  const pt2in = n => n / PPI
  const drawctx = {PDF, doc, PPI, pt2in, in2pt
    ,pt2cm: n => pt2in(n) * 2.54
    ,cm2pt: n => in2pt(n / 2.54)
    ,pt2mm: n => pt2in(n) * 25.4
    ,mm2pt: n => in2pt(n / 25.4)
    ,fix: (n,d=3) => Number(n.toFixed(d))
  }

  async function do_draw() {
    drawctx.doc = await PDF.PDFDocument.create()
    let code = `
${getcode()}
;return doc
    `
    let f = new AsyncFunction(...Object.keys(drawctx), code)
    let doc = await f(...Object.values(drawctx))

    let data = await doc.save()
    let blob = new Blob([data.buffer], {type: 'application/pdf'})
    let url = URL.createObjectURL(blob)
    let iframe = $('#view-iframe')
    iframe.src = url
  }

  window.draw = showmsg => {
    ++window.draw.n
    if (showmsg && (window.draw.n < 3)) {
      msg('💁 You can also run your code by pressing <b>'+MOD+'+Enter</b>.')
    }
    do_draw()
  }
  window.draw.n = -1

  let js = new CM.lang.LanguageSupport(CM.js.javascriptLanguage, [
    CM.js.javascriptLanguage.data.of({autocomplete: completeFromObject(drawctx)})
  ])

  ed = new CM.EditorView({
//    doc: db.get(`file__${current_file}`) || new_file,
    extensions: [
      CM.view.EditorView.updateListener.of(debounce(1000, e => {
        db.set(`file__${current_file}`, getcode())
        files[current_file].t = Date.now()
        db.set('files', files)
        db.set('current_file', current_file)
      })),
      CM.view.keymap.of([
        {key: MOD+'-Enter', run: () => {return true}},
        {key: MOD+'-p', run: () => {return true}},
        {key: MOD+'-s', run: () => {return true}},
      ]),
      CM.view.keymap.of([CM.cmd.indentWithTab]),
      CM.basicSetup, js,
    ],
    parent: $('#code')
  })

  if (files[current_file])
    loadfile(current_file)
  else
    newfile('pdfbbq', intro)
}

window.db = db

init()
populate_recents()

