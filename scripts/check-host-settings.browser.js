// Run after opening Models -> Qoder in an isolated real DSH Host.
async page => {
  const card = page.locator('[data-qoder-models-card]')
  const context = card.getByRole('combobox', { name: '上下文窗口', exact: true }).first()
  const output = card.getByRole('combobox', { name: '最大输出', exact: true }).first()
  await context.selectOption('500000')
  await card.getByText('已保存，并从 Host 重新读取。', { exact: false }).waitFor()
  await context.selectOption('1000000')
  await card.getByText('已保存，并从 Host 重新读取。', { exact: false }).waitFor()
  await output.selectOption('8192')
  await card.getByText('已保存，并从 Host 重新读取。', { exact: false }).waitFor()
  await card.screenshot({ path: 'output/playwright/actual-host-settings.png' })
  await page.reload()
  await page.getByRole('button', { name: '账号菜单', exact: true }).click()
  await page.getByRole('menuitem', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: '模型', exact: true }).click()
  // Provider editor may need to be expanded again after reloading.
  if (await card.count() === 0) {
    const row = page.locator('button').filter({ hasText: 'Qoder CN' })
    if (await row.count()) await row.first().click()
  }
  await context.waitFor()
  if (await context.inputValue() !== '1000000' || await output.inputValue() !== '8192') throw new Error('Real Host persistence failed')
  await card.locator('.qoder-models > summary').click()
  await card.locator('.qoder-model > summary').first().click()
  await card.screenshot({ path: 'output/playwright/actual-host-model-details.png' })
}
