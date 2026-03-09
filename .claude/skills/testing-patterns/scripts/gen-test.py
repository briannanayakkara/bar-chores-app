#!/usr/bin/env python3
"""Generate test boilerplate for a given component or utility file.

Usage:
    python gen-test.py src/components/staff/TaskCard.tsx
    python gen-test.py src/lib/color.ts
"""

import sys
import os
import re


def generate_component_test(filepath: str, name: str) -> str:
    return f"""import {{ render, screen }} from '@testing-library/react'
import {{ describe, it, expect }} from 'vitest'
import {name} from './{name}'

describe('{name}', () => {{
  it('renders without crashing', () => {{
    render(<{name} />)
  }})

  it.todo('add meaningful test cases')
}})
"""


def generate_utility_test(filepath: str, name: str) -> str:
    return f"""import {{ describe, it, expect }} from 'vitest'
// Import functions to test:
// import {{ functionName }} from './{name}'

describe('{name}', () => {{
  it.todo('add test cases for exported functions')
}})
"""


def main():
    if len(sys.argv) < 2:
        print("Usage: python gen-test.py <filepath>")
        sys.exit(1)

    filepath = sys.argv[1]
    basename = os.path.basename(filepath)
    name = os.path.splitext(basename)[0]
    ext = os.path.splitext(basename)[1]

    is_component = name[0].isupper() and ext == '.tsx'
    test_ext = '.test.tsx' if ext == '.tsx' else '.test.ts'
    test_path = filepath.replace(ext, test_ext)

    if os.path.exists(test_path):
        print(f"Test file already exists: {test_path}")
        sys.exit(1)

    if is_component:
        content = generate_component_test(filepath, name)
    else:
        content = generate_utility_test(filepath, name)

    with open(test_path, 'w') as f:
        f.write(content)

    print(f"Created: {test_path}")


if __name__ == '__main__':
    main()
