import { executeSync, parse } from  'graphql'
import weakMemoize from '@emotion/weak-memoize'

import { assertNever } from  './DocumentEditor/component-blocks/utils'
const labelFieldAlias = '____document_field_relationship_item_label'
const idFieldAlias = '____document_field_relationship_item_id'

export function addRelationshipData(nodes, context, relationships, componentBlocks) {
  return Promise.all(nodes.map(async node => {
    if (node.type === 'relationship') {
      const relationship = relationships[node.relationship]
      if (!relationship) return node

      return {
        ...node,
        data: await fetchDataForOne(context, relationship.listKey, relationship.selection || '', node.data),
      };
    }
    if (node.type === 'component-block') {
      const componentBlock = componentBlocks[node.component]
      if (componentBlock) {
        const [props, children] = await Promise.all([
          addRelationshipDataToComponentProps(
            { kind: 'object', fields: componentBlock.schema },
            node.props,
            (relationship, data) =>
              fetchRelationshipData(
                context,
                relationship.listKey,
                relationship.many,
                relationship.selection || '',
                data
              )
          ),
          addRelationshipData(node.children, context, relationships, componentBlocks),
        ])
        return {
          ...node,
          props,
          children,
        }
      }
    }
    if ('children' in node && Array.isArray(node.children)) {
      return {
        ...node,
        children: await addRelationshipData(node.children, context, relationships, componentBlocks),
      };
    }
    return node
  }));
}

export async function fetchRelationshipData (
  context,
  listKey,
  many,
  selection,
  data
) {
  if (!many) return fetchDataForOne(context, listKey, selection, data);

  const ids = Array.isArray(data) ? data.filter(item => item.id != null).map(x => x.id) : []
  if (!ids.length) return []

  const labelField = getLabelFieldsForLists(context.graphql.schema)[listKey]
  const val = (await context.graphql.run({
    query: `query($ids: [ID!]!) {items:${
      context.__internal.lists[listKey].graphql.names.listQueryName
    }(where: { id: { in: $ids } }) {${idFieldAlias}:id ${labelFieldAlias}:${labelField}\n${
      selection || ''
    }}}`,
    variables: { ids },
  }))

  return Array.isArray(val.items)
    ? val.items.map(({ [labelFieldAlias]: label, [idFieldAlias]: id, ...data }) => {
        return { id, label, data }
      })
    : [];
}

async function fetchDataForOne (
  context,
  listKey,
  selection,
  data
) {
  // Single related item
  const id = data?.id
  if (id == null) return null

  const labelField = getLabelFieldsForLists(context.graphql.schema)[listKey]

  // An exception here indicates something wrong with either the system or the
  // configuration (e.g. a bad selection field). These will surface as system
  // errors from the GraphQL field resolver.
  const val = (await context.graphql.run({
    query: `query($id: ID!) {item:${
      context.__internal.lists[listKey].graphql.names.itemQueryName
    }(where: {id:$id}) {${labelFieldAlias}:${labelField}\n${selection}}}`,
    variables: { id },
  }))

  if (val.item === null) return { id, data: undefined, label: undefined }
  return {
    id,
    label: val.item[labelFieldAlias],
    data: () => {
      const { [labelFieldAlias]: _ignore, ...otherData } = val.item
      return otherData
    }(),
  };
}

export async function addRelationshipDataToComponentProps(schema, val, fetchData) {
  switch (schema.kind) {
    case 'child':
    case 'form': {
      return val
    }
    case 'relationship': {
      return fetchData(schema, val);
    }
    case 'object': {
      return Object.fromEntries(await Promise.all(Object.keys(schema.fields).map(async key => [
        key,
        // if val[key] === undefined, we know a new field was added to the schema
        // but there is old data in the database that doesn't have the new field
        // we're intentionally not just magically adding it because we may want to
        // have a more optimised strategy of hydrating relationships so we don't
        // want to add something unrelated that requires the current "traverse everything" strategy
        val[key] === undefined
          ? undefined
          : await addRelationshipDataToComponentProps(schema.fields[key], val[key], fetchData),
      ])));
    }
    case 'conditional': {
      return {
        discriminant: val.discriminant,
        value: await addRelationshipDataToComponentProps(schema.values[val.discriminant], val.value, fetchData),
      };
    }
    case 'array': {
      return await Promise.all((val).map(async innerVal =>
        addRelationshipDataToComponentProps(schema.element, innerVal, fetchData)));
    }
  }
  assertNever(schema)
}

const document = parse(`
  query {
    keystone {
      adminMeta {
        lists {
          key
          labelField
        }
      }
    }
  }
`)

export const getLabelFieldsForLists = weakMemoize(function getLabelFieldsForLists(schema) {
  const { data, errors } = executeSync({
    schema,
    document,
    contextValue: { isAdminUIBuildProcess: true },
  })
  if (errors?.length) throw errors[0]
  return Object.fromEntries(data.keystone.adminMeta.lists.map(x => [x.key, x.labelField]));
})
