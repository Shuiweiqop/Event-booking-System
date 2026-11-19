import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import Modal from './Modal'

function Harness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false)
  const close = () => {
    onClose()
    setOpen(false)
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open</button>
      <button type="button">Outside</button>
      {open && (
        <Modal title="Dialog" onClose={close}>
          <input aria-label="Name" />
          <button type="button">Save</button>
        </Modal>
      )}
    </>
  )
}

const open = async () => {
  render(<Harness />)
  await userEvent.click(screen.getByRole('button', { name: 'Open' }))
}

describe('<Modal />', () => {
  it('focuses the first field when opened', async () => {
    await open()
    expect(screen.getByLabelText('Name')).toHaveFocus()
  })

  it('keeps Tab inside the dialog (wraps from last to first)', async () => {
    await open()
    // Name -> Save -> (wrap) Close -> Name ...
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByLabelText('Name')).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Outside' })).not.toHaveFocus()
  })

  it('keeps Shift+Tab inside the dialog (wraps from first to last)', async () => {
    await open()
    await userEvent.tab() // Save
    await userEvent.tab() // Close (first focusable in DOM order)
    await userEvent.tab({ shift: true }) // back from first -> wraps to last (Save)
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus()
  })

  it('skips hidden inputs when choosing what to focus', async () => {
    render(
      <>
        <button type="button">Behind</button>
        <Modal title="Dialog" onClose={() => {}}>
          <input type="hidden" name="token" value="x" />
          <input aria-label="Visible" />
        </Modal>
      </>,
    )
    expect(screen.getByLabelText('Visible')).toHaveFocus()
  })

  it('keeps focus inside the dialog even when it has no fields', async () => {
    render(
      <>
        <button type="button">Behind</button>
        <Modal title="Dialog" onClose={() => {}}><p>Just text</p></Modal>
      </>,
    )
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement)
    expect(screen.getByRole('button', { name: 'Behind' })).not.toHaveFocus()
  })

  it('cannot be closed while closeDisabled (e.g. saving)', async () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal title="Saving" onClose={onClose} closeDisabled><input aria-label="Name" /></Modal>,
    )

    await userEvent.keyboard('{Escape}')
    await userEvent.click(container.querySelector('.modal-backdrop'))
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()

    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape and returns focus to the button that opened it', async () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(opener)

    await userEvent.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
