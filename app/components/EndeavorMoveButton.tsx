'use client'

import { useState } from 'react'
import { Button } from 'primereact/button'
import { MoveEndeavorModal } from './MoveEndeavorModal'

interface EndeavorMoveButtonProps {
  endeavorId: string
  endeavorTitle: string
  currentContextId: string
  onMoved?: () => void
}

export function EndeavorMoveButton({
  endeavorId,
  endeavorTitle,
  currentContextId,
  onMoved
}: EndeavorMoveButtonProps) {
  const [showMoveModal, setShowMoveModal] = useState(false)

  const handleMoved = () => {
    setShowMoveModal(false)
    onMoved?.()
  }

  return (
    <>
      <Button
        icon="pi pi-arrow-right"
        label="Move"
        size="small"
        outlined
        onClick={() => setShowMoveModal(true)}
        tooltip="Move this endeavor to another context"
        tooltipOptions={{ position: 'bottom' }}
      />

      <MoveEndeavorModal
        visible={showMoveModal}
        onHide={() => setShowMoveModal(false)}
        endeavorId={endeavorId}
        endeavorTitle={endeavorTitle}
        currentContextId={currentContextId}
        onMoved={handleMoved}
      />
    </>
  )
}

export default EndeavorMoveButton