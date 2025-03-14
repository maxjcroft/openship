import { Fragment, createContext, useContext, useMemo, useCallback, useEffect, useRef } from 'react'
import { Editor, Transforms } from 'slate'
import { ReactEditor, useFocused, useSelected, useSlateStatic as useStaticEditor } from 'slate-react'

import { ToolbarButton } from '../Toolbar'
import { insertNodesButReplaceIfSelectionIsAtEmptyParagraphOrHeading } from '../utils'
import { useElementWithSetNodes, useEventCallback } from '../utils-hooks'
import { getInitialValue } from './initial-values'
import { createGetPreviewProps } from './preview-props'
import { updateComponentBlockElementProps } from './update-element'
import { ComponentBlockRender } from './component-block-render'
import { ChromefulComponentBlockElement } from './chromeful-element'
import { ChromelessComponentBlockElement } from './chromeless-element'

export { withComponentBlocks } from './with-component-blocks'

export const ComponentBlockContext = createContext({})

export function ComponentInlineProp(props) {
  return <span {...props.attributes}>{props.children}</span>
}

export function insertComponentBlock(editor, componentBlocks, componentBlock) {
  const node = getInitialValue(componentBlock, componentBlocks[componentBlock])
  insertNodesButReplaceIfSelectionIsAtEmptyParagraphOrHeading(editor, node)

  const componentBlockEntry = Editor.above(editor, {
    match: node => node.type === 'component-block',
  })

  if (componentBlockEntry) {
    const start = Editor.start(editor, componentBlockEntry[1])
    Transforms.setSelection(editor, { anchor: start, focus: start })
  }
}

export function BlockComponentsButtons({ onClose }) {
  const editor = useStaticEditor()
  const blockComponents = useContext(ComponentBlockContext)
  return (
    <Fragment>
      {Object.keys(blockComponents).map(key => (
        <ToolbarButton
          key={key}
          onMouseDown={event => {
            event.preventDefault()
            insertComponentBlock(editor, blockComponents, key)
            onClose()
          }}>
          {blockComponents[key].label}
        </ToolbarButton>
      ))}
    </Fragment>
  )
}

export function ComponentBlocksElement({
  attributes,
  children,
  element: __elementToGetPath
}) {
  const editor = useStaticEditor()
  const focused = useFocused()
  const selected = useSelected()
  const [currentElement, setElement] = useElementWithSetNodes(editor, __elementToGetPath)
  const blockComponents = useContext(ComponentBlockContext)
  const componentBlock = blockComponents[currentElement.component]

  const elementToGetPathRef = useRef({ __elementToGetPath, currentElement })

  useEffect(() => {
    elementToGetPathRef.current = { __elementToGetPath, currentElement }
  })

  const onRemove = useEventCallback(() => {
    const path = ReactEditor.findPath(editor, __elementToGetPath)
    Transforms.removeNodes(editor, { at: path })
  })

  const onPropsChange = useCallback((cb) => {
    const prevProps = elementToGetPathRef.current.currentElement.props
    updateComponentBlockElementProps(
      editor,
      componentBlock,
      prevProps,
      cb(prevProps),
      ReactEditor.findPath(editor, elementToGetPathRef.current.__elementToGetPath),
      setElement
    )
  }, [setElement, componentBlock, editor])

  const getToolbarPreviewProps = useMemo(() => {
    if (!componentBlock) {
      return () => {
        throw new Error('expected component block to exist when called')
      }
    }
    return createGetPreviewProps(
      { kind: 'object', fields: componentBlock.schema },
      onPropsChange,
      () => undefined
    )
  }, [componentBlock, onPropsChange])

  if (!componentBlock) {
    return (
      <div className="border-4 border-red-500 p-4">
        <pre className="select-none" contentEditable={false}>
          {`The block "${currentElement.component}" no longer exists.\n\nProps:\n\n${JSON.stringify(currentElement.props, null, 2)}\n\nContent:`}
        </pre>
        {children}
      </div>
    )
  }

  const toolbarPreviewProps = getToolbarPreviewProps(currentElement.props)

  const renderedBlock = (
    <ComponentBlockRender
      children={children}
      componentBlock={componentBlock}
      element={currentElement}
      onChange={onPropsChange} />
  )

  return componentBlock.chromeless ? (
    <ChromelessComponentBlockElement
      attributes={attributes}
      renderedBlock={renderedBlock}
      componentBlock={componentBlock}
      isOpen={focused && selected}
      onRemove={onRemove}
      previewProps={toolbarPreviewProps} />
  ) : (
    <ChromefulComponentBlockElement
      attributes={attributes}
      children={children}
      componentBlock={componentBlock}
      onRemove={onRemove}
      previewProps={toolbarPreviewProps}
      renderedBlock={renderedBlock}
      elementProps={currentElement.props} />
  )
}
