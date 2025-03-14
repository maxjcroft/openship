/** @jest-environment jsdom */
/** @jsxRuntime classic */
/** @jsx jsx */
import { makeEditor } from './tests/utils';

test('inserting a heading with a shortcut works', () => {
  const editor = makeEditor(<editor>
    <paragraph>
      <text>
        #
        <cursor />
      </text>
    </paragraph>
  </editor>)

  editor.insertText(' ')
  expect(editor).toMatchInlineSnapshot(`
    <editor>
      <heading
        level={1}
      >
        <text>
          <cursor />
        </text>
      </heading>
      <paragraph>
        <text />
      </paragraph>
    </editor>
  `)
})

test('inserting a break at the end of the heading exits the heading', () => {
  const editor = makeEditor(<editor>
    <heading level={1}>
      <text>
        Some heading
        <cursor />
      </text>
    </heading>
    <paragraph>
      <text />
    </paragraph>
  </editor>)

  editor.insertBreak()
  expect(editor).toMatchInlineSnapshot(`
    <editor>
      <heading
        level={1}
      >
        <text>
          Some heading
        </text>
      </heading>
      <paragraph>
        <text>
          <cursor />
        </text>
      </paragraph>
      <paragraph>
        <text />
      </paragraph>
    </editor>
  `)
})

test(
  'inserting a break in the middle of the heading splits the text and does not exit the heading',
  () => {
    const editor = makeEditor(<editor>
      <heading level={1}>
        <text>
          Some <cursor />
          heading
        </text>
      </heading>
      <paragraph>
        <text />
      </paragraph>
    </editor>)

    editor.insertBreak()
    expect(editor).toMatchInlineSnapshot(`
      <editor>
        <heading
          level={1}
        >
          <text>
            Some 
          </text>
        </heading>
        <heading
          level={1}
        >
          <text>
            <cursor />
            heading
          </text>
        </heading>
        <paragraph>
          <text />
        </paragraph>
      </editor>
    `)
  }
)

test(
  'inserting a break at the start of the heading inserts a paragraph above the heading',
  () => {
    const editor = makeEditor(<editor>
      <heading level={1}>
        <text>
          <cursor />
          Some heading
        </text>
      </heading>
      <paragraph>
        <text />
      </paragraph>
    </editor>)

    editor.insertBreak()
    expect(editor).toMatchInlineSnapshot(`
      <editor>
        <paragraph>
          <text />
        </paragraph>
        <heading
          level={1}
        >
          <text>
            <cursor />
            Some heading
          </text>
        </heading>
        <paragraph>
          <text />
        </paragraph>
      </editor>
    `)
  }
)
