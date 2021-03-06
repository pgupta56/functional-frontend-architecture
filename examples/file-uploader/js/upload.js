const Type = require('union-type');

const map = require('ramda/src/map')
    , reduce = require('ramda/src/reduce')
    , curry  = require('ramda/src/curry')
    , contains  = require('ramda/src/contains')
    , always  = require('ramda/src/always')
    , merge  = require('ramda/src/merge')
    , evolve  = require('ramda/src/evolve')
    , dissoc = require('ramda/src/dissoc')
;

const h = require('snabbdom/h')
    , s = require('./svg');

const noop = function(){};

// model

const init = (files) => (
  {
    status: 'initial',
    progress: {},
    abort: noop,
    title: (files.length === 1 
              ? files[0].name 
              : '(' + files.length + ' files)' ),
    files: map(initFile, files)
  }
)

const initFile = ({name,lastModifiedDate,size,type}) => (
  {name,lastModifiedDate,size,type}
)

const size = (model) => (
  reduce( (tot,file) => tot + (file.size || 0), 0, model.files )
)

const status = curry( (s, model) => model.status == s );
const uploading = status('uploading');

const aborted = (model) => model.status == 'aborted'

const abortable = (model) => (
  !!model.abort && contains(model.status, ['uploading'])
)

const hasProgressData = (x) => (
  !(x.loaded === undefined || x.total === undefined) 
)

const percentProgress = (p) => {
  if (!hasProgressData(p)) return null;
  return p.loaded / p.total;
}


// action

// NOTE: no side-effects initiated, so all updates simply return changed state

const Action = Type({
  Progress: [Function, hasProgressData],
  Uploaded: [],
  Error: [],
  Abort: []
});

const update = Action.caseOn({
  Progress: (abort,{loaded,total},model) => {
    return evolve({ status:   always(loaded < total ? 'uploading' : 'processing'),
                    progress: always({loaded, total}),
                    abort:  always(abort)
                 })(model);
  },
  Uploaded: evolve({status: always('uploaded')}),
  Error:    evolve({status: always('error')}),
  Abort:    evolve({status: always('abort')})
});


// view

const view = curry( ({progress},model) => {

  progress = merge({width: 200, height: 20}, progress || {});
  
  return (
    h('div', { attrs: { 'class': 'upload ' + model.status }, 
               style: style.upload 
             },  [
      h('div.title',    {style: style.div},  [ renderTitle(model)             ]),
      h('div.size',     {style: style.div},  [ ''+size(model)                 ]),
      h('div.progress', {style: style.div},  [ renderProgress(model,progress) ]),
      h('div.status',   {style: style.div},  [ renderStatus(model)            ]),
      h('div.abort',    {style: dissoc('margin-right', style.div)},   
                                             [ renderAbort(model)             ])
    ])
  );

});

const renderTitle = (model) => (
  model.url
    ?  h('a', { attrs: {'href': model.url,
                        'target': '_blank'
                       } 
              }, [ model.title ])

    :  h('span', {}, [ model.title ]) 
)


const renderProgress = (model,specs) => {
  const barwidth = percentProgress(model.progress) * specs.width;
  const linespecs = { x1: specs.width, x2: specs.width,
                      y1: 0,           y2: specs.height };

  const rect = (
    s('rect', { attrs: { height: specs.height,
                         width: barwidth,
                         class: 'bar'
                       }
              })
  );

  const line = (
    s('line', { attrs: merge(linespecs, {class: 'end'}) } )
  );

  return (
    s('svg', {attrs: specs}, [
      s('g', {}, (barwidth > 0) ? [rect,line] : [])
     ])       
  );

}

const renderStatus = (model) => h('span', {}, statusLabel(model))


const renderAbort = (model) => (
  h('a', { style: merge(visible(abortable, model), {cursor: 'pointer'}),
           on: { click: model.abort } }, 
    actionLabel('abort')
  )
)


const statusLabel = (model) => (
  {
    'initial': null,
    'uploading': 'uploading',
    'processing': 'processing',
    'uploaded': 'done',
    'error': 'error',
    'abort': 'stopped' 
  }[model.status] || null
)

const actionLabel = (action) => (
  {
    'abort': '×'
  }[action] || null
)


// view styles 

const style = { 
  upload: { 'display': 'inline-block' }, 
  div:    { 'display': 'inline-block',
            'vertical-align': 'top',
            'margin-right': '1rem'
          }
}


// view utils

const visible = (pred,model) => (
  { display: pred(model) ? null : 'none' }
)


module.exports = {init, Action, update, view};


