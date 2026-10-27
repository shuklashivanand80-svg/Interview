import React from 'react'
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CreateSessionTab from '../src/renderer/views/dashboard/CreateSessionTab'

describe('New Interview Screen (CreateSessionTab)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('renders target company, role, job description, resume and background brief fields', () => {
    render(<CreateSessionTab onContinue={vi.fn()} />)

    expect(screen.getByRole('heading', { name: /New Interview/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Google')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Software Engineer')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Paste the job description here/i)).toBeInTheDocument()
    expect(screen.getByText(/Add your resume/i)).toBeInTheDocument()
    expect(screen.getByText(/Add a background brief/i)).toBeInTheDocument()
  })

  it('validates file upload format and enforces 5MB limit', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<CreateSessionTab onContinue={vi.fn()} />)

    const fileInputs = container.querySelectorAll('input[type="file"]')
    expect(fileInputs.length).toBe(2)
    const resumeInput = fileInputs[0] as HTMLInputElement

    // 1. Invalid extension .exe
    const invalidFile = new File(['bad'], 'exploit.exe', { type: 'application/x-msdownload' })
    fireEvent.change(resumeInput, { target: { files: [invalidFile] } })
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('Unsupported file type'))

    // 2. Oversized file > 5MB
    alertMock.mockClear()
    const oversizedFile = new File([new Uint8Array(6 * 1024 * 1024)], 'huge_resume.pdf', { type: 'application/pdf' })
    Object.defineProperty(oversizedFile, 'size', { value: 6 * 1024 * 1024 })
    fireEvent.change(resumeInput, { target: { files: [oversizedFile] } })
    expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('5 MB'))

    // 3. Valid PDF file
    const originalFileReader = global.FileReader
    class MockFileReader {
      onload: any = null
      readAsDataURL() {
        this.onload?.({ target: { result: 'data:application/pdf;base64,mock' } })
      }
    }
    ;(global as any).FileReader = MockFileReader

    alertMock.mockClear()
    const validFile = new File(['valid content'], 'my_cv.pdf', { type: 'application/pdf' })
    Object.defineProperty(validFile, 'size', { value: 50000 })
    fireEvent.change(resumeInput, { target: { files: [validFile] } })
    expect(alertMock).not.toHaveBeenCalled()
    expect(screen.getByText('my_cv.pdf')).toBeInTheDocument()

    // 4. File removal
    const removeBtn = screen.getByTitle('Remove file')
    fireEvent.click(removeBtn)
    expect(screen.queryByText('my_cv.pdf')).not.toBeInTheDocument()
    expect(screen.getByText(/Add your resume/i)).toBeInTheDocument()

    global.FileReader = originalFileReader
    alertMock.mockRestore()
  })

  it('disables Continue button when required company or role is empty', () => {
    const onContinue = vi.fn()
    render(<CreateSessionTab onContinue={onContinue} />)

    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).toBeDisabled()

    // Fill only company
    fireEvent.change(screen.getByPlaceholderText('e.g. Google'), { target: { value: 'Google' } })
    expect(continueBtn).toBeDisabled()

    // Fill role
    fireEvent.change(screen.getByPlaceholderText('e.g. Software Engineer'), { target: { value: 'Staff Engineer' } })
    expect(continueBtn).not.toBeDisabled()

    // Click continue
    fireEvent.click(continueBtn)
    expect(onContinue).toHaveBeenCalledWith(expect.objectContaining({
      company: 'Google',
      role: 'Staff Engineer',
    }))
  })

  it('rejects whitespace-only input for required fields', () => {
    const onContinue = vi.fn()
    render(<CreateSessionTab onContinue={onContinue} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Google'), { target: { value: '   ' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Software Engineer'), { target: { value: '   ' } })

    const continueBtn = screen.getByRole('button', { name: /Continue/i })
    expect(continueBtn).toBeDisabled()
  })

  it('enforces 5000 character limit on Job Description', () => {
    render(<CreateSessionTab onContinue={vi.fn()} />)

    const jdTextarea = screen.getByPlaceholderText(/Paste the job description here/i)
    const longText = 'A'.repeat(5050)

    fireEvent.change(jdTextarea, { target: { value: longText } })

    // Input longer than 5000 should not be allowed into state
    expect((jdTextarea as HTMLTextAreaElement).value.length).toBeLessThanOrEqual(5000)
    expect(screen.getByText(/0\/5000/)).toBeInTheDocument()

    // Valid 100 chars
    fireEvent.change(jdTextarea, { target: { value: 'A'.repeat(100) } })
    expect(screen.getByText(/100\/5000/)).toBeInTheDocument()
  })

  it('persists entered draft data to localStorage for navigation restoration', () => {
    const { unmount } = render(<CreateSessionTab onContinue={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Google'), { target: { value: 'cagi' } })
    fireEvent.change(screen.getByPlaceholderText('e.g. Software Engineer'), { target: { value: 'Software Eng' } })

    const saved = JSON.parse(localStorage.getItem('ip_session_config') || '{}')
    expect(saved.company).toBe('cagi')
    expect(saved.role).toBe('Software Eng')

    unmount()

    // Re-render: should automatically restore previous inputs
    render(<CreateSessionTab onContinue={vi.fn()} />)
    expect((screen.getByPlaceholderText('e.g. Google') as HTMLInputElement).value).toBe('cagi')
    expect((screen.getByPlaceholderText('e.g. Software Engineer') as HTMLInputElement).value).toBe('Software Eng')
  })

  it('supports initialData passed from parent when editing', () => {
    const initialData = {
      company: 'Amazon',
      role: 'Principal Architect',
      jd: 'Cloud systems',
      resume: { name: 'MyResume.pdf', size: 120000 },
      brief: null,
    }

    render(<CreateSessionTab initialData={initialData} onContinue={vi.fn()} />)

    expect((screen.getByPlaceholderText('e.g. Google') as HTMLInputElement).value).toBe('Amazon')
    expect((screen.getByPlaceholderText('e.g. Software Engineer') as HTMLInputElement).value).toBe('Principal Architect')
    expect(screen.getByText('MyResume.pdf')).toBeInTheDocument()
  })
})
