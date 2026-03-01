import boto3
import time

dynamodb = boto3.resource('dynamodb', region_name='us-east-2')
users_table = dynamodb.Table('users')
invitations_table = dynamodb.Table('invitations')


def handler(event, context):
    attrs = event['request']['userAttributes']
    sub = attrs['sub']
    email = attrs['email']
    name = attrs.get('name') or email

    users_table.put_item(Item={
        'id': sub,
        'email': email,
        'name': name,
        'created_at': int(time.time() * 1000),
    })

    invitations_table.update_item(
        Key={'email': email},
        UpdateExpression='SET #s = :accepted',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':accepted': 'accepted'},
    )

    return event
