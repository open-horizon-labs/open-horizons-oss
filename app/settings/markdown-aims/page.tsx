'use client'

import { MarkdownImporter } from './components/MarkdownImporter'

export default function ImportMarkdownAimsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Import from Markdown
        </h2>
        <p className="text-gray-600 max-w-2xl">
          Import your aims, missions, and initiatives from markdown format. 
          We&apos;ll intelligently match against existing content and show you exactly 
          what changes will be made before committing.
        </p>
      </div>
      
      <MarkdownImporter />
    </div>
  )
}